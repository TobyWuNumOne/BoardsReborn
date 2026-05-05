<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { useEventListener } from '@vueuse/core';
import { ArrowLeftIcon, CalendarIcon, SearchIcon, TriangleAlertIcon } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
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
  getTaipeiTodayDateString,
  hasAdminWorkOrderCreateUnsavedChanges,
  normalizeAdminWorkOrderCreateFormState,
  shouldResetCustomerLookupResolution,
} from '~/utils/admin-work-order-create';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import { normalizeTaiwanMobilePhoneInput } from '~/utils/phone';
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

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

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

const mergedFieldErrors = computed<Record<string, string[]>>(() => ({
  ...(submitApiError.value?.error.fieldErrors ?? {}),
  ...clientFieldErrors.value,
}));
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

const clearLookupState = (options: { preserveCustomerName?: boolean } = {}) => {
  const preserveCustomerName = options.preserveCustomerName ?? true;
  const draftName = preserveCustomerName ? form.customerName : '';

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

const lookupCustomers = async () => {
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

  lookupStatus.value = 'loading';

  try {
    const response = await getRequestFetch()<AdminCustomerLookupResponse>(
      '/api/admin/customers/lookup',
      {
        query: {
          phone: form.customerPhone,
        },
      },
    );

    lookupResults.value = response.data;
    lastLookupPhone.value = normalizedPhone;
    lookupApiError.value = null;

    if (response.data.length === 0) {
      lookupStatus.value = 'empty';
      form.customerModeDecision = 'create';
      form.selectedCustomerId = '';
      return;
    }

    lookupStatus.value = 'success';
    form.customerModeDecision = 'unresolved';
    form.selectedCustomerId = '';
  } catch (error) {
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
    await navigateTo(getAdminWorkOrderDetailPath(response.data.id));
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
  form.boardType =
    typeof value === 'string' &&
    ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS.some((option) => option.value === value)
      ? (value as typeof form.boardType)
      : '';

  if (form.boardType !== 'SURFBOARD') {
    form.boardLengthClass = '';
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

    if (lastLookupPhone.value === null) {
      return;
    }

    if (!shouldResetCustomerLookupResolution(lastLookupPhone.value, nextValue)) {
      return;
    }

    clearLookupState({ preserveCustomerName: true });
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
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-28">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">New work order</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">新增工單</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            以現場收件流程快速建立工單。第一版只負責建立工單本身，後續拍照、列印、追加報價與狀態更新留在下一步流程。
          </p>
        </div>

        <Button type="button" variant="outline" class="w-full md:w-auto" @click="navigateToList">
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
        <CardContent class="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel for="paper-order-no">紙本工單號</FieldLabel>
            <Input
              id="paper-order-no"
              v-model="form.paperOrderNo"
              autofocus
              autocomplete="off"
              placeholder="例如 BR-2026-0001"
            />
            <FieldError :errors="mergedFieldErrors.paperOrderNo" />
          </Field>

          <Field>
            <FieldLabel for="intake-date">收件日期</FieldLabel>
            <Popover v-model:open="intakeDatePopoverOpen">
              <PopoverTrigger as-child>
                <Button
                  id="intake-date"
                  type="button"
                  variant="outline"
                  class="w-full justify-between text-left font-normal"
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

          <Field class="md:col-span-2">
            <FieldLabel for="customer-phone">顧客手機</FieldLabel>
            <div class="flex flex-col gap-2 md:flex-row">
              <Input
                id="customer-phone"
                v-model="form.customerPhone"
                autocomplete="tel"
                inputmode="tel"
                placeholder="輸入完整 09xxxxxxxx"
              />
              <Button
                type="button"
                variant="outline"
                class="w-full md:w-auto"
                :disabled="isLookupLoading || isSubmitting"
                @click="lookupCustomers"
              >
                <SearchIcon data-icon="inline-start" />
                {{ isLookupLoading ? '查詢中' : '查詢顧客' }}
              </Button>
            </div>
            <FieldDescription>先查既有顧客；查無資料時再建立新顧客。</FieldDescription>
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

              <Button type="button" variant="outline" size="sm" @click="setCreateMode">
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
                    'rounded-lg border p-4 text-left transition-colors',
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
            <FieldLabel for="customer-name">顧客姓名</FieldLabel>
            <Input
              id="customer-name"
              v-model="form.customerName"
              autocomplete="name"
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
        <CardContent class="space-y-5">
          <Field>
            <FieldLabel>板型</FieldLabel>
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
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
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
                <div class="space-y-1">
                  <p class="font-medium">{{ option.label }}</p>
                  <p class="text-sm text-muted-foreground">{{ option.description }}</p>
                </div>
              </label>
            </RadioGroup>
            <FieldError :errors="mergedFieldErrors.boardType" />
          </Field>

          <Field v-if="form.boardType === 'SURFBOARD'">
            <FieldLabel>長度分類</FieldLabel>
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
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
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
                <div class="space-y-1">
                  <p class="font-medium">{{ option.label }}</p>
                  <p class="text-sm text-muted-foreground">{{ option.description }}</p>
                </div>
              </label>
            </RadioGroup>
            <FieldDescription>只對衝浪板使用，不從尺寸標記自動推論。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.boardLengthClass" />
          </Field>

          <div class="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel for="board-size-label">尺寸標記</FieldLabel>
              <Input id="board-size-label" v-model="form.boardSizeLabel" placeholder="例如 6'2" />
            </Field>

            <Field>
              <FieldLabel for="board-brand">品牌</FieldLabel>
              <Input
                id="board-brand"
                v-model="form.boardBrand"
                placeholder="例如 Channel Islands"
              />
            </Field>

            <Field>
              <FieldLabel for="board-model">型號</FieldLabel>
              <Input id="board-model" v-model="form.boardModel" placeholder="例如 Happy" />
            </Field>
          </div>

          <Field>
            <FieldLabel>顏色</FieldLabel>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              <button
                v-for="option in ADMIN_WORK_ORDER_CREATE_BOARD_COLOR_OPTIONS"
                :key="option.value"
                type="button"
                :class="
                  cn(
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    option.className,
                    form.boardColorChoice === option.value && 'ring-ring/40 ring-3',
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
              class="mt-3"
              placeholder="輸入自訂顏色，例如 藍白漸層"
            />
            <FieldDescription>顏色只做現場辨識輔助，不作為主要識別欄位。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.boardColorChoice" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. 維修資訊</CardTitle>
          <CardDescription>預估完成日預設為收件週期後的下週日，可再調整。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <Field class="md:col-span-2">
            <FieldLabel for="damage-description">損傷描述</FieldLabel>
            <Textarea
              id="damage-description"
              v-model="form.damageDescription"
              placeholder="描述收件時的主要傷況與待修內容"
            />
            <FieldError :errors="mergedFieldErrors.damageDescription" />
          </Field>

          <Field>
            <FieldLabel>預估完成日</FieldLabel>
            <Popover v-model:open="estimatedDatePopoverOpen">
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full justify-between text-left font-normal"
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
            <FieldDescription>會隨收件日預設下週日；手動調整後不再自動覆蓋。</FieldDescription>
            <FieldError :errors="mergedFieldErrors.estimatedCompletionDate" />
          </Field>

          <Field>
            <FieldLabel for="public-note">公開備註</FieldLabel>
            <Textarea id="public-note" v-model="form.publicNote" placeholder="顧客可見的補充說明" />
          </Field>

          <Field class="md:col-span-2">
            <FieldLabel for="internal-note">內部備註</FieldLabel>
            <Textarea
              id="internal-note"
              v-model="form.internalNote"
              placeholder="僅內部可見的交接資訊"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. 報價資訊</CardTitle>
          <CardDescription>第一版只收初始報價；追加報價留到後續維修流程。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel for="initial-quote-amount">初始報價</FieldLabel>
            <Input
              id="initial-quote-amount"
              v-model="form.initialQuoteAmount"
              inputmode="numeric"
              placeholder="可留空，例如 500"
            />
            <FieldError :errors="mergedFieldErrors.initialQuoteAmount" />
          </Field>

          <Field>
            <FieldLabel for="initial-quote-description">報價備註</FieldLabel>
            <Input
              id="initial-quote-description"
              v-model="form.initialQuoteDescription"
              placeholder="留空時預設為初始報價"
            />
            <FieldError :errors="mergedFieldErrors.initialQuoteDescription" />
          </Field>

          <Field class="md:col-span-2">
            <div class="flex items-start gap-3">
              <Checkbox id="payment-received" v-model="form.paymentReceived" class="mt-0.5" />
              <div class="space-y-1">
                <FieldLabel for="payment-received">已收款</FieldLabel>
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
          <CardTitle>5. 備註與提交</CardTitle>
          <CardDescription
            >建單頁第一版只建立工單本身；後續拍照與列印會在詳情頁補上。</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-3 text-sm text-muted-foreground">
          <p>建立成功後狀態固定為「已收件」。</p>
          <p>若目前只是暫時記錄，稍後仍可到詳情頁的 `mode=edit` 進一步修正非狀態欄位。</p>
        </CardContent>
      </Card>

      <div
        class="sticky bottom-0 z-10 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur"
      >
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1 text-sm text-muted-foreground">
            <p>主要入口已集中在本頁，適合平板現場快速收件。</p>
            <p v-if="hasUnsavedChanges">目前有尚未送出的工單內容。</p>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 md:flex">
            <Button
              type="button"
              variant="outline"
              class="w-full md:w-auto"
              :disabled="isSubmitting || isLookupLoading"
              @click="resetForm"
            >
              清除
            </Button>
            <Button
              type="submit"
              class="w-full md:w-auto"
              :disabled="isSubmitting || isLookupLoading"
            >
              {{ isSubmitting ? '建立中…' : '建立工單' }}
            </Button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
