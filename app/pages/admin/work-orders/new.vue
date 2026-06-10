<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { useEventListener } from '@vueuse/core';
import { ArrowLeftIcon, CalendarIcon, MapPinnedIcon, SearchIcon, TriangleAlertIcon } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { RepairCountSource, RepairMark } from '~/utils/repair-marks';
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import type {
  AdminCustomerLookupCandidate,
  AdminCustomerLookupResponse,
  AdminWorkOrderCreateResponse,
} from '~/utils/admin-work-order-create';
import {
  extractApiErrorEnvelope,
  formatAdminDate,
  getAdminWorkOrderDetailPath,
  getApiErrorStatusCode,
} from '~/utils/admin-work-orders';
import {
  ADMIN_WORK_ORDER_CREATE_BOARD_COLOR_OPTIONS,
  ADMIN_WORK_ORDER_CREATE_BOARD_LENGTH_CLASS_OPTIONS,
  ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS,
  buildAdminWorkOrderCreatePayload,
  createAdminWorkOrderCreateInitialFormState,
  getFixedNextSundayDateString,
  getAdminWorkOrderCreateBoardColorButtonClassName,
  getTaipeiTodayDateString,
  hasAdminWorkOrderCreateUnsavedChanges,
  normalizeAdminWorkOrderCreateFormState,
  resolveAdminCustomerLookupCandidates,
  shouldAutoLookupCustomerPhone,
  shouldResetCustomerLookupResolution,
} from '~/utils/admin-work-order-create';
import {
  adjustBoardSizeLabel,
  adjustInitialQuoteAmount,
  appendDelimitedText,
  appendLineText,
  DAMAGE_DESCRIPTION_QUICK_CHIPS,
  ESTIMATED_COMPLETION_DATE_QUICK_ACTIONS,
  getBoardSizeQuickOptions,
  getEstimatedCompletionDateQuickValue,
  getRequiredFieldSummary,
  INITIAL_QUOTE_ADJUSTMENTS,
  INITIAL_QUOTE_QUICK_AMOUNTS,
  INTERNAL_NOTE_QUICK_CHIPS,
  PUBLIC_NOTE_QUICK_CHIPS,
  sanitizeNumericInput,
} from '~/utils/admin-work-order-create-tablet';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import { normalizeTaiwanMobilePhoneInput } from '~/utils/phone';
import { deriveRepairCount } from '~/utils/repair-marks';
import RepairMarksEditorDialog from '~/components/work-orders/RepairMarksEditorDialog.vue';
import { cn } from '@/lib/utils';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth'],
});

useHead({
  title: '新增工單 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const requiredHintClass = 'ml-1 text-xs font-medium text-destructive';
const optionalHintClass = 'ml-1 text-xs font-normal text-muted-foreground';

const DEV_REPAIR_MARKS_PREVIEW_QUERY_KEY = 'repairMarksPreview';
const DEV_REPAIR_MARKS_PREVIEW_BOARD_TYPE_QUERY_KEY = 'previewBoardType';

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const AUTO_LOOKUP_DELAY_MS = 250;
let autoLookupTimer: number | null = null;
let lookupRequestToken = 0;

const form = reactive(createAdminWorkOrderCreateInitialFormState());
const baselineSnapshot = shallowRef(normalizeAdminWorkOrderCreateFormState(form));
const clientFieldErrors = ref<Record<string, string[]>>({});
const lookupResults = ref<AdminCustomerLookupCandidate[]>([]);
const lookupStatus = ref<'empty' | 'error' | 'idle' | 'loading' | 'success'>('idle');
const lookupApiError = shallowRef<ApiErrorEnvelope | null>(null);
const submitApiError = shallowRef<ApiErrorEnvelope | null>(null);
const isSubmitting = ref(false);
const lastLookupPhone = ref<string | null>(null);
const unsavedGuardEnabled = ref(true);
const intakeDatePopoverOpen = ref(false);
const estimatedDatePopoverOpen = ref(false);
const repairMarksDialogOpen = ref(false);

const currentSnapshot = computed(() => normalizeAdminWorkOrderCreateFormState(form));
const hasUnsavedChanges = computed(
  () =>
    unsavedGuardEnabled.value &&
    hasAdminWorkOrderCreateUnsavedChanges(baselineSnapshot.value, currentSnapshot.value),
);
const selectedCustomer = computed(
  () => lookupResults.value.find((candidate) => candidate.id === form.selectedCustomerId) ?? null,
);
const showCreateCustomerFields = computed(() => form.customerModeDecision === 'create');
const hasLookupCandidates = computed(
  () => lookupStatus.value === 'success' && lookupResults.value.length > 0,
);
const showLookupPrompt = computed(
  () =>
    hasLookupCandidates.value &&
    form.customerModeDecision === 'unresolved' &&
    !form.selectedCustomerId,
);
const showPaymentWithoutQuoteWarning = computed(
  () => form.paymentReceived && currentSnapshot.value.initialQuoteAmount === '',
);
const isLookupLoading = computed(() => lookupStatus.value === 'loading');
const boardSizeQuickOptions = computed(() => getBoardSizeQuickOptions(form.boardLengthClass));
const requiredFieldSummary = computed(() => getRequiredFieldSummary(form));
const repairMarksCount = computed(() => form.repairMarks.length);
const showRepairCountMismatch = computed(() => {
  if (form.repairCountSource !== 'manual' || !form.repairCount) {
    return false;
  }

  return Number.parseInt(form.repairCount, 10) !== repairMarksCount.value;
});
const missingRequiredFieldText = computed(() =>
  requiredFieldSummary.value.missingLabels.length > 0
    ? `尚未完成：${requiredFieldSummary.value.missingLabels.join('、')}`
    : '必要欄位已完成',
);

const isRepairMarksPreviewEnabled = computed(() => {
  if (!import.meta.client || !import.meta.dev) {
    return false;
  }

  const value = route.query[DEV_REPAIR_MARKS_PREVIEW_QUERY_KEY];
  return value === '1' || value === 'true';
});

const repairMarksPreviewBoardType = computed(() => {
  const value = route.query[DEV_REPAIR_MARKS_PREVIEW_BOARD_TYPE_QUERY_KEY];

  if (typeof value !== 'string') {
    return 'SURFBOARD' as const;
  }

  return ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS)[number]['value'])
    : ('SURFBOARD' as const);
});
const getSafeCalendarDate = (value: string) => {
  try {
    return parseDate(value);
  } catch {
    return parseDate(getTaipeiTodayDateString());
  }
};
const estimatedCalendarValue = computed({
  get: () =>
    getSafeCalendarDate(
      form.estimatedCompletionDate || form.intakeDate || getTaipeiTodayDateString(),
    ),
  set: (value) => {
    if (!value) {
      return;
    }

    form.estimatedCompletionDate = value.toString();
    form.estimatedCompletionDateManuallyEdited = true;
    estimatedDatePopoverOpen.value = false;
    delete clientFieldErrors.value.estimatedCompletionDate;
  },
});
const intakeCalendarValue = computed({
  get: () => getSafeCalendarDate(form.intakeDate || getTaipeiTodayDateString()),
  set: (value) => {
    if (!value) {
      return;
    }

    form.intakeDate = value.toString();
    intakeDatePopoverOpen.value = false;
    clearFieldError('intakeDate');
  },
});

const mergedFieldErrors = computed<Record<string, string[]>>(() => {
  const nextErrors: Record<string, string[]> = {
    ...clientFieldErrors.value,
  };

  for (const [field, messages] of Object.entries(submitApiError.value?.error.fieldErrors ?? {})) {
    nextErrors[field] = messages;

    const alias = field.split('.').at(-1);

    if (alias && !(alias in nextErrors)) {
      nextErrors[alias] = messages;
    }
  }

  return nextErrors;
});
const formAlertMessages = computed(() => {
  const messages: string[] = [];

  if (lookupApiError.value && !lookupApiError.value.error.fieldErrors?.customerPhone) {
    messages.push(lookupApiError.value.error.message);
  }

  if (submitApiError.value) {
    messages.push(submitApiError.value.error.message);
  }

  return Array.from(new Set(messages));
});

const clearFieldError = (field: string) => {
  if (!(field in clientFieldErrors.value)) {
    return;
  }

  clientFieldErrors.value = Object.fromEntries(
    Object.entries(clientFieldErrors.value).filter(([entryField]) => entryField !== field),
  );
};

const clearAutoLookupTimer = () => {
  if (autoLookupTimer === null) {
    return;
  }

  clearTimeout(autoLookupTimer);
  autoLookupTimer = null;
};

const clearLookupState = (options: { preserveCustomerName?: boolean } = {}) => {
  const preserveCustomerName = options.preserveCustomerName ?? true;
  const draftName = preserveCustomerName ? form.customerName : '';

  lookupRequestToken += 1;
  clearAutoLookupTimer();
  form.customerModeDecision = 'unresolved';
  form.selectedCustomerId = '';
  form.customerName = draftName;
  lookupResults.value = [];
  lookupStatus.value = 'idle';
  lookupApiError.value = null;
  lastLookupPhone.value = null;
};

const resetForm = () => {
  const nextState = createAdminWorkOrderCreateInitialFormState(getTaipeiTodayDateString());

  lookupRequestToken += 1;
  clearAutoLookupTimer();
  Object.assign(form, nextState);
  clientFieldErrors.value = {};
  lookupApiError.value = null;
  submitApiError.value = null;
  lookupResults.value = [];
  lookupStatus.value = 'idle';
  lastLookupPhone.value = null;
  unsavedGuardEnabled.value = true;
  intakeDatePopoverOpen.value = false;
  estimatedDatePopoverOpen.value = false;
  baselineSnapshot.value = normalizeAdminWorkOrderCreateFormState(nextState);
};

const clearUnsavedGuard = () => {
  unsavedGuardEnabled.value = false;
  baselineSnapshot.value = currentSnapshot.value;
};

const applyRepairMarksPreviewState = async () => {
  if (!isRepairMarksPreviewEnabled.value) {
    return;
  }

  form.boardType = repairMarksPreviewBoardType.value;

  if (form.boardType === 'SURFBOARD' && !form.boardLengthClass) {
    form.boardLengthClass = 'MID_LENGTH';
  }

  if (form.repairCountSource === 'auto' && !form.repairCount) {
    form.repairCount = '';
  }

  await nextTick();
  repairMarksDialogOpen.value = true;
};

if (import.meta.client) {
  watch(
    () => [
      isRepairMarksPreviewEnabled.value,
      repairMarksPreviewBoardType.value,
    ],
    () => {
      void applyRepairMarksPreviewState();
    },
    { immediate: true },
  );
}

const confirmDiscardChanges = () => {
  if (!hasUnsavedChanges.value || !import.meta.client) {
    return true;
  }

  return window.confirm('目前有未建立的工單內容，確定要離開嗎？');
};

const navigateToList = async () => {
  if (!confirmDiscardChanges()) {
    return;
  }

  await navigateTo('/admin/work-orders');
};

const maybeHandleAdminAuthRedirect = async (error: unknown) => {
  const statusCode = getApiErrorStatusCode(error);

  if (statusCode !== 401 && statusCode !== 403) {
    return false;
  }

  const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
  const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

  if (redirectTarget) {
    await navigateTo(redirectTarget);
  }

  return true;
};

const setCreateMode = () => {
  form.customerModeDecision = 'create';
  form.selectedCustomerId = '';
  clearFieldError('customerName');
  clearFieldError('selectedCustomerId');
};

const selectExistingCustomer = (candidate: AdminCustomerLookupCandidate) => {
  form.customerModeDecision = 'reuse';
  form.selectedCustomerId = candidate.id;
  clearFieldError('selectedCustomerId');
  clearFieldError('customerPhone');
};

const scheduleAutoLookup = () => {
  if (!import.meta.client) {
    return;
  }

  clearAutoLookupTimer();
  autoLookupTimer = window.setTimeout(() => {
    autoLookupTimer = null;
    void lookupCustomers({ trigger: 'auto' });
  }, AUTO_LOOKUP_DELAY_MS);
};

const lookupCustomers = async (options: { trigger?: 'auto' | 'manual' } = {}) => {
  const trigger = options.trigger ?? 'manual';

  clearAutoLookupTimer();
  clearFieldError('customerPhone');
  clearFieldError('selectedCustomerId');
  lookupApiError.value = null;

  const normalizedPhone = normalizeTaiwanMobilePhoneInput(form.customerPhone);

  if (!normalizedPhone) {
    clientFieldErrors.value = {
      ...clientFieldErrors.value,
      customerPhone: ['請輸入完整台灣手機號碼。'],
    };
    return;
  }

  if (
    trigger === 'auto' &&
    (lookupStatus.value === 'loading' || normalizedPhone === lastLookupPhone.value)
  ) {
    return;
  }

  const requestToken = ++lookupRequestToken;
  lookupStatus.value = 'loading';

  try {
    const response = await getRequestFetch()<AdminCustomerLookupResponse>(
      '/api/admin/customers/lookup',
      {
        query: {
          phone: normalizedPhone,
        },
      },
    );

    if (requestToken !== lookupRequestToken) {
      return;
    }

    lookupResults.value = response.data;
    lastLookupPhone.value = normalizedPhone;
    lookupApiError.value = null;
    clearFieldError('customerName');
    clearFieldError('selectedCustomerId');

    const resolution = resolveAdminCustomerLookupCandidates(response.data);

    lookupStatus.value = response.data.length === 0 ? 'empty' : 'success';
    form.customerModeDecision = resolution.customerModeDecision;
    form.selectedCustomerId = resolution.selectedCustomerId;
  } catch (error) {
    if (requestToken !== lookupRequestToken) {
      return;
    }

    if (await maybeHandleAdminAuthRedirect(error)) {
      return;
    }

    lookupStatus.value = 'error';
    lookupApiError.value = extractApiErrorEnvelope(error);

    if (lookupApiError.value?.error.fieldErrors?.customerPhone) {
      clientFieldErrors.value = {
        ...clientFieldErrors.value,
        customerPhone: lookupApiError.value.error.fieldErrors.customerPhone,
      };
    } else {
      toast.error('查詢顧客失敗。');
    }
  }
};

const submitCreateForm = async () => {
  if (isSubmitting.value) {
    return;
  }

  submitApiError.value = null;
  lookupApiError.value = null;
  clientFieldErrors.value = {};

  const { fieldErrors, payload } = buildAdminWorkOrderCreatePayload(form);

  if (Object.keys(fieldErrors).length > 0 || !payload) {
    clientFieldErrors.value = fieldErrors;
    toast.error('請先修正表單欄位。');
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await getRequestFetch()<AdminWorkOrderCreateResponse>(
      '/api/admin/work-orders',
      {
        body: payload,
        method: 'POST',
      },
    );

    clearUnsavedGuard();
    toast.success('工單已建立');
    await navigateTo(`${getAdminWorkOrderDetailPath(response.data.id)}?created=1`);
  } catch (error) {
    if (await maybeHandleAdminAuthRedirect(error)) {
      return;
    }

    submitApiError.value = extractApiErrorEnvelope(error);
    toast.error('建立工單失敗。', {
      description: submitApiError.value?.error.message,
    });
  } finally {
    isSubmitting.value = false;
  }
};

const handleBoardTypeChange = (value: unknown) => {
  const previousBoardType = form.boardType;
  const nextBoardType =
    typeof value === 'string' &&
    ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS.some((option) => option.value === value)
      ? (value as typeof form.boardType)
      : '';

  if (
    form.repairMarks.length > 0 &&
    form.boardType &&
    nextBoardType &&
    form.boardType !== nextBoardType &&
    import.meta.client &&
    !window.confirm('變更板型會清除既有受損位置標記，確定要繼續嗎？')
  ) {
    return;
  }

  form.boardType =
    nextBoardType;

  if (form.boardType !== 'SURFBOARD') {
    form.boardLengthClass = '';
  }

  if (previousBoardType && previousBoardType !== nextBoardType) {
    form.repairMarks = [];
    form.repairCount = '';
    form.repairCountSource = 'auto';
  }

  clearFieldError('boardType');
  clearFieldError('boardLengthClass');
};

const handleBoardLengthClassChange = (value: unknown) => {
  form.boardLengthClass =
    typeof value === 'string' &&
    ADMIN_WORK_ORDER_CREATE_BOARD_LENGTH_CLASS_OPTIONS.some((option) => option.value === value)
      ? (value as typeof form.boardLengthClass)
      : '';

  clearFieldError('boardLengthClass');
};

const handleBoardColorChoice = (value: string) => {
  form.boardColorChoice = value as typeof form.boardColorChoice;

  if (value !== 'OTHER') {
    form.boardColorOther = '';
  }

  clearFieldError('boardColorChoice');
};

const handleCustomerPhoneInput = (value: string | number) => {
  form.customerPhone = sanitizeNumericInput(value);
};

const handleInitialQuoteAmountInput = (value: string | number) => {
  form.initialQuoteAmount = sanitizeNumericInput(value);
};

const selectBoardSizeQuickOption = (value: string) => {
  form.boardSizeLabel = value;
};

const adjustBoardSize = (deltaInches: number) => {
  const nextValue = adjustBoardSizeLabel(form.boardSizeLabel, deltaInches);

  if (!nextValue) {
    toast.info('請先選擇尺寸。');
    return;
  }

  form.boardSizeLabel = nextValue;
};

const applyEstimatedCompletionDateQuickAction = (offsetDays: number) => {
  const nextValue = getEstimatedCompletionDateQuickValue(getTaipeiTodayDateString(), offsetDays);

  if (!nextValue) {
    return;
  }

  form.estimatedCompletionDate = nextValue;
  form.estimatedCompletionDateManuallyEdited = true;
  clearFieldError('estimatedCompletionDate');
};

const applyInitialQuoteQuickAmount = (amount: number) => {
  form.initialQuoteAmount = String(amount);
  clearFieldError('initialQuoteAmount');
};

const adjustInitialQuote = (amount: number) => {
  form.initialQuoteAmount = adjustInitialQuoteAmount(form.initialQuoteAmount, amount);
  clearFieldError('initialQuoteAmount');
};

const appendDamageDescriptionChip = (value: string) => {
  form.damageDescription = appendDelimitedText(form.damageDescription, value);
  clearFieldError('damageDescription');
};

const appendPublicNoteChip = (value: string) => {
  form.publicNote = appendLineText(form.publicNote, value);
};

const appendInternalNoteChip = (value: string) => {
  form.internalNote = appendLineText(form.internalNote, value);
};

const togglePaymentReceived = () => {
  form.paymentReceived = !form.paymentReceived;
};

const openRepairMarksDialog = () => {
  if (!form.boardType) {
    toast.info('請先選擇板型。');
    return;
  }

  repairMarksDialogOpen.value = true;
};

const handleRepairMarksSave = (payload: {
  repairCount: string;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
}) => {
  form.repairMarks = payload.repairMarks;
  form.repairCountSource = payload.repairCountSource;
  form.repairCount =
    payload.repairCountSource === 'auto'
      ? (() => {
          const derivedCount = deriveRepairCount(payload.repairMarks);
          return derivedCount === null ? '' : String(derivedCount);
        })()
      : payload.repairCount;
  clearFieldError('repairCount');
};

watch(
  () => form.intakeDate,
  (nextValue, previousValue) => {
    if (nextValue === previousValue) {
      return;
    }

    clearFieldError('intakeDate');

    if (!form.estimatedCompletionDateManuallyEdited) {
      form.estimatedCompletionDate = getFixedNextSundayDateString(nextValue);
    }
  },
);

watch(
  () => form.customerPhone,
  (nextValue, previousValue) => {
    if (nextValue === previousValue) {
      return;
    }

    clearFieldError('customerPhone');
    clearAutoLookupTimer();

    if (lastLookupPhone.value === null) {
      if (shouldAutoLookupCustomerPhone(lastLookupPhone.value, nextValue)) {
        scheduleAutoLookup();
      }

      return;
    }

    if (shouldResetCustomerLookupResolution(lastLookupPhone.value, nextValue)) {
      clearLookupState({ preserveCustomerName: true });
    }

    if (shouldAutoLookupCustomerPhone(lastLookupPhone.value, nextValue)) {
      scheduleAutoLookup();
    }
  },
);

watch(
  () => form.paperOrderNo,
  () => clearFieldError('paperOrderNo'),
);
watch(
  () => form.customerName,
  () => clearFieldError('customerName'),
);
watch(
  () => form.damageDescription,
  () => clearFieldError('damageDescription'),
);
watch(
  () => form.boardLengthClass,
  () => clearFieldError('boardLengthClass'),
);
watch(
  () => form.initialQuoteAmount,
  () => clearFieldError('initialQuoteAmount'),
);
watch(
  () => form.initialQuoteDescription,
  () => clearFieldError('initialQuoteDescription'),
);
watch(
  () => form.estimatedCompletionDate,
  () => clearFieldError('estimatedCompletionDate'),
);

onBeforeRouteLeave(() => {
  if (!confirmDiscardChanges()) {
    return false;
  }

  return true;
});

onBeforeUnmount(() => {
  lookupRequestToken += 1;
  clearAutoLookupTimer();
});

if (import.meta.client) {
  const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges.value) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  };

  useEventListener(window, 'beforeunload', beforeUnloadHandler);
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-40">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">New work order</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">新增工單</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            以現場收件流程快速建立工單。第一版只負責建立工單本身，後續拍照、列印、追加報價與狀態更新留在下一步流程。
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          class="h-12 w-full md:w-auto"
          @click="navigateToList"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          返回列表
        </Button>
      </div>
    </div>

    <Alert v-if="formAlertMessages.length" variant="destructive">
      <TriangleAlertIcon class="size-4" />
      <AlertTitle>目前無法完成建單</AlertTitle>
      <AlertDescription class="space-y-2">
        <p v-for="message in formAlertMessages" :key="message">{{ message }}</p>
        <p
          v-if="submitApiError?.error.requestId || lookupApiError?.error.requestId"
          class="text-xs text-muted-foreground"
        >
          requestId:
          {{ submitApiError?.error.requestId ?? lookupApiError?.error.requestId }}
        </p>
      </AlertDescription>
    </Alert>

    <form class="flex flex-col gap-6" @submit.prevent="submitCreateForm">
      <Card>
        <CardHeader>
          <CardTitle>1. 工單與顧客</CardTitle>
          <CardDescription>先確認紙本工單號，再用手機號碼查詢既有顧客。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-5 md:grid-cols-2">
          <Field class="md:col-span-2">
            <FieldLabel for="paper-order-no">
              紙本工單號
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <Input
              id="paper-order-no"
              v-model="form.paperOrderNo"
              autofocus
              autocomplete="off"
              class="h-12 text-base"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="例如 BR-2026-0001"
              type="text"
            />
            <FieldError :errors="mergedFieldErrors.paperOrderNo" />
          </Field>

          <Field class="md:col-span-2">
            <FieldLabel for="customer-phone">
              顧客手機
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <div class="flex flex-col gap-3 md:flex-row">
              <Input
                id="customer-phone"
                autocomplete="tel"
                class="h-12 text-base"
                inputmode="numeric"
                :model-value="form.customerPhone"
                pattern="[0-9]*"
                placeholder="輸入完整 09xxxxxxxx"
                type="tel"
                @update:model-value="handleCustomerPhoneInput"
              />
              <Button
                type="button"
                variant="outline"
                class="h-12 w-full md:w-auto"
                :disabled="isLookupLoading || isSubmitting"
                @click="lookupCustomers"
              >
                <SearchIcon data-icon="inline-start" />
                {{ isLookupLoading ? '查詢中' : '查詢顧客' }}
              </Button>
            </div>
            <FieldDescription>
              輸入完整手機後會自動查詢；查無資料時再建立新顧客。
            </FieldDescription>
            <FieldError :errors="mergedFieldErrors.customerPhone" />
          </Field>

          <div v-if="lookupStatus === 'empty'" class="md:col-span-2">
            <Alert>
              <AlertTitle>查無既有顧客</AlertTitle>
              <AlertDescription>將以目前手機號碼建立新顧客。</AlertDescription>
            </Alert>
          </div>

          <div v-if="hasLookupCandidates" class="md:col-span-2 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium">查到 {{ lookupResults.length }} 位候選顧客</p>
                <p class="text-sm text-muted-foreground">請選擇既有顧客，或改為建立新顧客。</p>
              </div>

              <Button type="button" variant="outline" class="h-11" @click="setCreateMode">
                改為建立新顧客
              </Button>
            </div>

            <div class="grid gap-3 md:grid-cols-2">
              <button
                v-for="candidate in lookupResults"
                :key="candidate.id"
                type="button"
                :class="
                  cn(
                    'min-h-16 rounded-lg border p-4 text-left transition-colors',
                    form.selectedCustomerId === candidate.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )
                "
                @click="selectExistingCustomer(candidate)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-1">
                    <p class="font-medium">{{ candidate.name || '未命名顧客' }}</p>
                    <p class="text-sm text-muted-foreground">{{ candidate.phone || '—' }}</p>
                  </div>
                  <Badge v-if="form.selectedCustomerId === candidate.id" variant="secondary">
                    使用中
                  </Badge>
                </div>
              </button>
            </div>

            <FieldError :errors="mergedFieldErrors.selectedCustomerId" />

            <Alert v-if="showLookupPrompt">
              <AlertTitle>請選擇既有顧客或改為建立新顧客</AlertTitle>
              <AlertDescription>目前尚未決定這張工單要重用哪位顧客。</AlertDescription>
            </Alert>
          </div>

          <Field v-if="showCreateCustomerFields" class="md:col-span-2">
            <FieldLabel for="customer-name">
              顧客姓名
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <Input
              id="customer-name"
              v-model="form.customerName"
              autocomplete="name"
              class="h-12 text-base"
              placeholder="輸入顧客姓名"
            />
            <FieldError :errors="mergedFieldErrors.customerName" />
          </Field>

          <div
            v-if="form.customerModeDecision === 'reuse' && selectedCustomer"
            class="md:col-span-2"
          >
            <Alert>
              <AlertTitle>已選擇既有顧客</AlertTitle>
              <AlertDescription>
                {{ selectedCustomer.name || '未命名顧客' }} / {{ selectedCustomer.phone || '—' }}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 板子資訊</CardTitle>
          <CardDescription>板型必填，其餘快照欄位以現場辨識為優先。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <Field>
            <FieldLabel>
              板型
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <RadioGroup
              :model-value="form.boardType || undefined"
              class="grid gap-3 md:grid-cols-3"
              @update:model-value="handleBoardTypeChange"
            >
              <label
                v-for="option in ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS"
                :key="option.value"
                :for="`board-type-${option.value}`"
                :class="
                  cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                    form.boardType === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30',
                  )
                "
              >
                <RadioGroupItem
                  :id="`board-type-${option.value}`"
                  :value="option.value"
                  class="mt-0.5"
                />
                <p class="font-medium">{{ option.label }}</p>
              </label>
            </RadioGroup>
            <FieldError :errors="mergedFieldErrors.boardType" />
          </Field>

          <Field v-if="form.boardType === 'SURFBOARD'">
            <FieldLabel>
              長度分類
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <RadioGroup
              :model-value="form.boardLengthClass || undefined"
              class="grid gap-3 md:grid-cols-3"
              @update:model-value="handleBoardLengthClassChange"
            >
              <label
                v-for="option in ADMIN_WORK_ORDER_CREATE_BOARD_LENGTH_CLASS_OPTIONS"
                :key="option.value"
                :for="`board-length-class-${option.value}`"
                :class="
                  cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                    form.boardLengthClass === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30',
                  )
                "
              >
                <RadioGroupItem
                  :id="`board-length-class-${option.value}`"
                  :value="option.value"
                  class="mt-0.5"
                />
                <p class="font-medium">{{ option.label }}</p>
              </label>
            </RadioGroup>
            <FieldDescription>只對衝浪板使用，不從尺寸標記自動推論。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.boardLengthClass" />
          </Field>

          <div class="grid gap-4 md:grid-cols-3">
            <Field class="md:col-span-3">
              <div class="flex flex-wrap items-end justify-between gap-2">
                <FieldLabel for="board-size-label">
                  尺寸標記
                  <span :class="optionalHintClass">不必填</span>
                </FieldLabel>
                <span v-if="form.boardSizeLabel" class="text-sm text-muted-foreground">
                  目前尺寸：{{ form.boardSizeLabel }}
                </span>
              </div>
              <div class="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  id="board-size-label"
                  v-model="form.boardSizeLabel"
                  class="h-12 text-base"
                  placeholder="例如 6'2"
                />
                <div class="grid grid-cols-2 gap-2 md:flex">
                  <Button
                    type="button"
                    variant="outline"
                    class="h-12 min-w-20"
                    @click="adjustBoardSize(-1)"
                  >
                    -1 英寸
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    class="h-12 min-w-20"
                    @click="adjustBoardSize(1)"
                  >
                    +1 英寸
                  </Button>
                </div>
              </div>
              <div v-if="boardSizeQuickOptions.length > 0" class="flex flex-wrap gap-2">
                <Button
                  v-for="sizeOption in boardSizeQuickOptions"
                  :key="sizeOption"
                  type="button"
                  :variant="form.boardSizeLabel === sizeOption ? 'default' : 'outline'"
                  class="h-11 min-w-16"
                  @click="selectBoardSizeQuickOption(sizeOption)"
                >
                  {{ sizeOption }}
                </Button>
              </div>
              <FieldDescription>尺寸快捷依長度分類顯示；仍可手動輸入特殊尺寸。</FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel>
              顏色
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              <button
                v-for="option in ADMIN_WORK_ORDER_CREATE_BOARD_COLOR_OPTIONS"
                :key="option.value"
                type="button"
                :aria-pressed="form.boardColorChoice === option.value"
                :class="
                  getAdminWorkOrderCreateBoardColorButtonClassName(
                    option.className,
                    form.boardColorChoice === option.value,
                  )
                "
                @click="handleBoardColorChoice(option.value)"
              >
                {{ option.label }}
              </button>
            </div>

            <Input
              v-if="form.boardColorChoice === 'OTHER'"
              v-model="form.boardColorOther"
              class="mt-3 h-12 text-base"
              placeholder="輸入自訂顏色，例如 藍白漸層"
            />
            <FieldDescription>顏色只做現場辨識輔助，不作為主要識別欄位。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.boardColorChoice" />
          </Field>

          <div class="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel for="board-brand">
                品牌
                <span :class="optionalHintClass">不必填</span>
              </FieldLabel>
              <Input
                id="board-brand"
                v-model="form.boardBrand"
                class="h-12 text-base"
                placeholder="例如 Channel Islands"
              />
            </Field>

            <Field>
              <FieldLabel for="board-model">
                型號
                <span :class="optionalHintClass">不必填</span>
              </FieldLabel>
              <Input
                id="board-model"
                v-model="form.boardModel"
                class="h-12 text-base"
                placeholder="例如 Happy"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. 損傷與照片</CardTitle>
          <CardDescription>先圈選維修位置，再用文字補充傷況。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
            <div class="space-y-1">
              <p class="text-sm font-medium">
                受損位置標記
                <span :class="requiredHintClass">（＊必填）</span>
              </p>
              <p class="text-sm text-muted-foreground">
                已標記 {{ repairMarksCount }} 處
                <span v-if="form.repairCountSource === 'manual' && form.repairCount">
                  ，維修處數 {{ form.repairCount }}
                </span>
              </p>
            </div>
            <Button type="button" variant="outline" class="h-11" @click="openRepairMarksDialog">
              <MapPinnedIcon class="size-4" />
              受損位置
            </Button>
          </div>
          <FieldError :errors="mergedFieldErrors.repairCount" />

          <Alert v-if="showRepairCountMismatch">
            <AlertTitle>維修處數已手動調整</AlertTitle>
            <AlertDescription>
              已標記 {{ repairMarksCount }} 處，但維修處數手動設定為 {{ form.repairCount }} 處。
            </AlertDescription>
          </Alert>

          <Field>
            <FieldLabel>
              常用損傷
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="chip in DAMAGE_DESCRIPTION_QUICK_CHIPS"
                :key="chip"
                type="button"
                variant="outline"
                class="h-11"
                @click="appendDamageDescriptionChip(chip)"
              >
                {{ chip }}
              </Button>
            </div>
          </Field>

          <Field>
            <FieldLabel for="damage-description">
              損傷描述
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <Textarea
              id="damage-description"
              v-model="form.damageDescription"
              class="min-h-36 text-base"
              placeholder="描述收件時的主要傷況與待修內容"
            />
            <FieldError :errors="mergedFieldErrors.damageDescription" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. 日期與報價</CardTitle>
          <CardDescription>保留既有日期選擇 UI，並加入常用日期與金額快捷操作。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel for="intake-date">
              收件日期
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <Popover v-model:open="intakeDatePopoverOpen">
              <PopoverTrigger as-child>
                <Button
                  id="intake-date"
                  type="button"
                  variant="outline"
                  class="h-12 w-full justify-between text-left font-normal"
                >
                  <span>
                    {{ form.intakeDate ? formatAdminDate(form.intakeDate) : '選擇日期' }}
                  </span>
                  <CalendarIcon class="text-muted-foreground size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-3">
                <Calendar v-model="intakeCalendarValue" initial-focus />
              </PopoverContent>
            </Popover>
            <FieldDescription>預設今天，可手動改成補登日期。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.intakeDate" />
          </Field>

          <Field>
            <FieldLabel>
              預估完成日
              <span :class="requiredHintClass">（＊必填）</span>
            </FieldLabel>
            <Popover v-model:open="estimatedDatePopoverOpen">
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  class="h-12 w-full justify-between text-left font-normal"
                >
                  <span>
                    {{
                      form.estimatedCompletionDate
                        ? formatAdminDate(form.estimatedCompletionDate)
                        : '選擇日期'
                    }}
                  </span>
                  <CalendarIcon class="text-muted-foreground size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-3">
                <Calendar v-model="estimatedCalendarValue" initial-focus />
              </PopoverContent>
            </Popover>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="action in ESTIMATED_COMPLETION_DATE_QUICK_ACTIONS"
                :key="action.label"
                type="button"
                variant="outline"
                class="h-11"
                @click="applyEstimatedCompletionDateQuickAction(action.offsetDays)"
              >
                {{ action.label }}
              </Button>
            </div>
            <FieldDescription>會隨收件日預設下週日；手動調整後不再自動覆蓋。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.estimatedCompletionDate" />
          </Field>

          <Field class="md:col-span-2">
            <FieldLabel for="initial-quote-amount">
              初始報價
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                id="initial-quote-amount"
                class="h-12 text-base"
                inputmode="numeric"
                :model-value="form.initialQuoteAmount"
                pattern="[0-9]*"
                placeholder="可留空，例如 500"
                type="text"
                @update:model-value="handleInitialQuoteAmountInput"
              />
              <div class="grid grid-cols-3 gap-2 md:flex">
                <Button
                  v-for="amount in INITIAL_QUOTE_ADJUSTMENTS"
                  :key="amount"
                  type="button"
                  variant="outline"
                  class="h-12 min-w-16"
                  @click="adjustInitialQuote(amount)"
                >
                  {{ amount > 0 ? `+${amount}` : amount }}
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="amount in INITIAL_QUOTE_QUICK_AMOUNTS"
                :key="amount"
                type="button"
                :variant="form.initialQuoteAmount === String(amount) ? 'default' : 'outline'"
                class="h-11 min-w-16"
                @click="applyInitialQuoteQuickAmount(amount)"
              >
                {{ amount }}
              </Button>
            </div>
            <FieldError :errors="mergedFieldErrors.initialQuoteAmount" />
          </Field>

          <Field>
            <FieldLabel for="initial-quote-description">
              報價備註
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <Input
              id="initial-quote-description"
              v-model="form.initialQuoteDescription"
              class="h-12 text-base"
              placeholder="留空時預設為初始報價"
            />
            <FieldError :errors="mergedFieldErrors.initialQuoteDescription" />
          </Field>

          <Field>
            <div
              aria-labelledby="payment-received-label"
              :aria-checked="form.paymentReceived"
              class="flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
              role="checkbox"
              tabindex="0"
              @click="togglePaymentReceived"
              @keydown.enter.prevent="togglePaymentReceived"
              @keydown.space.prevent="togglePaymentReceived"
            >
              <Checkbox
                id="payment-received"
                :model-value="form.paymentReceived"
                class="pointer-events-none mt-0.5"
              />
              <div class="space-y-1">
                <FieldLabel id="payment-received-label" for="payment-received">
                  已收款
                  <span :class="optionalHintClass">不必填</span>
                </FieldLabel>
                <p class="text-sm text-muted-foreground">
                  可先標記已收款，建立後由後端維護收款時間。
                </p>
              </div>
            </div>
          </Field>

          <div v-if="showPaymentWithoutQuoteWarning" class="md:col-span-2">
            <Alert>
              <TriangleAlertIcon class="size-4" />
              <AlertTitle>已標記收款，但尚未填初始報價</AlertTitle>
              <AlertDescription
                >這不會阻擋建單，但建議確認現場是否真的不需要先記錄初始報價。</AlertDescription
              >
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. 備註與建立</CardTitle>
          <CardDescription>交接資訊整合在備註區；建單後仍可到詳情頁修正。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel for="public-note">
              公開備註
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="chip in PUBLIC_NOTE_QUICK_CHIPS"
                :key="chip"
                type="button"
                variant="outline"
                class="h-11"
                @click="appendPublicNoteChip(chip)"
              >
                {{ chip }}
              </Button>
            </div>
            <Textarea
              id="public-note"
              v-model="form.publicNote"
              class="min-h-32 text-base"
              placeholder="顧客可見的補充說明"
            />
          </Field>

          <Field>
            <FieldLabel for="internal-note">
              內部備註
              <span :class="optionalHintClass">不必填</span>
            </FieldLabel>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="chip in INTERNAL_NOTE_QUICK_CHIPS"
                :key="chip"
                type="button"
                variant="outline"
                class="h-11"
                @click="appendInternalNoteChip(chip)"
              >
                {{ chip }}
              </Button>
            </div>
            <Textarea
              id="internal-note"
              v-model="form.internalNote"
              class="min-h-32 text-base"
              placeholder="僅內部可見的交接資訊"
            />
          </Field>

          <div class="space-y-3 text-sm text-muted-foreground md:col-span-2">
            <p>建立成功後狀態固定為「已收件」。</p>
            <p>若目前只是暫時記錄，稍後仍可到詳情頁的 `mode=edit` 進一步修正非狀態欄位。</p>
          </div>
        </CardContent>
      </Card>

      <div
        class="sticky bottom-0 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1 text-sm">
            <p class="font-medium text-foreground">
              必要欄位 {{ requiredFieldSummary.completed }} / {{ requiredFieldSummary.total }}
            </p>
            <p
              :class="
                requiredFieldSummary.missingLabels.length > 0
                  ? 'text-muted-foreground'
                  : 'text-emerald-700'
              "
            >
              {{ missingRequiredFieldText }}
            </p>
            <p v-if="hasUnsavedChanges">目前有尚未送出的工單內容。</p>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 md:flex">
            <Button
              type="button"
              variant="outline"
              class="h-12 w-full md:w-auto"
              :disabled="isSubmitting || isLookupLoading"
              @click="resetForm"
            >
              清除
            </Button>
            <Button
              type="submit"
              class="h-12 w-full md:w-auto"
              :disabled="isSubmitting || isLookupLoading"
            >
              {{ isSubmitting ? '建立中…' : '建立工單' }}
            </Button>
          </div>
        </div>
      </div>
    </form>

    <RepairMarksEditorDialog
      v-if="form.boardType"
      v-model:open="repairMarksDialogOpen"
      :board-type="form.boardType"
      :repair-count="form.repairCount"
      :repair-count-source="form.repairCountSource"
      :repair-marks="form.repairMarks"
      @save="handleRepairMarksSave"
    />
  </div>
</template>
