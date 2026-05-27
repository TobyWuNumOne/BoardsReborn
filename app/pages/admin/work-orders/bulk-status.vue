<script setup lang="ts">
import { nextTick } from 'vue';
import { toast } from 'vue-sonner';
import type { Database } from '../../../../types/database.types';
import type { AdminPrintSummaryItem, AdminPrintSummaryResponse } from '~/utils/admin-printing';
import {
  createEmptyAdminPrintSummary,
  getAdminPrintActionLabel,
  getAdminPrintingCenterPath,
} from '~/utils/admin-printing';
import type {
  AdminWorkOrderBulkStatusResponse,
  AdminWorkOrderResolveItem,
  AdminWorkOrderResolveResponse,
  ApiErrorEnvelope,
} from '~/utils/admin-work-orders';
import {
  ADMIN_WORK_ORDER_STATUS_OPTIONS,
  extractApiErrorEnvelope,
  formatAdminDate,
  formatAdminDateTime,
  getApiErrorStatusCode,
  getBoardLengthClassLabel,
  getBoardTypeLabel,
  getWorkOrderStatusLabel,
} from '~/utils/admin-work-orders';
import {
  ADMIN_BULK_STATUS_GROUP_ORDER,
  buildAdminBulkStatusSubmitPayload,
  getAdminBulkStatusSelectedPaperOrderNos,
  getAdminBulkStatusSkipReasonLabel,
  groupAdminBulkStatusPreviewItems,
  hasAdminBulkStatusSelectedSnowboards,
  parseAdminBulkStatusPaperOrderNos,
  resolveAdminBulkStatusPreview,
} from '~/utils/admin-work-order-bulk-status';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import PrintJobStatusBadge from '~/components/printing/PrintJobStatusBadge.vue';
import WorkOrderBoardColorSwatch from '~/components/work-orders/WorkOrderBoardColorSwatch.vue';
import WorkOrderFlagBadges from '~/components/work-orders/WorkOrderFlagBadges.vue';
import WorkOrderStatusBadge from '~/components/work-orders/WorkOrderStatusBadge.vue';
import { Textarea } from '~/components/ui/textarea';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;
type PreviewStatus = 'idle' | 'loading' | 'ready' | 'stale';

const BULK_STATUS_RESULT_SECTION_ID = 'recent-batch-result';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: '批量狀態 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const bulkInput = ref('');
const sharedStatus = ref<WorkOrderStatus | ''>('');
const sharedNote = ref('');
const previewStatus = ref<PreviewStatus>('idle');
const previewErrorMessage = ref<string | null>(null);
const inputFieldErrors = ref<Record<string, string[]>>({});
const submitClientFieldErrors = ref<Record<string, string[]>>({});
const submitApiError = ref<ApiErrorEnvelope | null>(null);
const foundItems = ref<AdminWorkOrderResolveItem[]>([]);
const notFoundPaperOrderNos = ref<string[]>([]);
const selectedPaperOrderNos = ref<string[]>([]);
const recentBatchResult = ref<AdminWorkOrderBulkStatusResponse['data'] | null>(null);
const previewPrintSummaries = ref<Record<string, AdminPrintSummaryItem>>({});
const recentBatchPrintSummaries = ref<Record<string, AdminPrintSummaryItem>>({});
const isSubmitting = ref(false);
const reprintingWorkOrderIds = ref<string[]>([]);
const submittingSelectedSnapshot = ref<string[]>([]);
const recentBatchResultElement = ref<HTMLElement | null>(null);
const statusValues = new Set(ADMIN_WORK_ORDER_STATUS_OPTIONS.map((option) => option.value));
const groupExpandedState = reactive<Record<WorkOrderStatus, boolean>>({
  CANCELLED: true,
  DELIVERED: true,
  DRYING: true,
  READY_FOR_PICKUP: true,
  RECEIVED: true,
  REPAIRING: true,
});

const parsedPaperOrderNos = computed(() => parseAdminBulkStatusPaperOrderNos(bulkInput.value));
const previewGroups = computed(() =>
  groupAdminBulkStatusPreviewItems(foundItems.value, selectedPaperOrderNos.value),
);
const selectedCount = computed(() => selectedPaperOrderNos.value.length);
const hasPreviewResults = computed(
  () => foundItems.value.length > 0 || notFoundPaperOrderNos.value.length > 0,
);
const isPreviewLoading = computed(() => previewStatus.value === 'loading');
const isPreviewReady = computed(() => previewStatus.value === 'ready');
const isPreviewStale = computed(() => previewStatus.value === 'stale');
const isInputLocked = computed(() => isPreviewLoading.value || isSubmitting.value);
const canRunPreviewSearch = computed(
  () => parsedPaperOrderNos.value.length > 0 && !isInputLocked.value,
);
const canRunSharedBulkAction = computed(
  () =>
    isPreviewReady.value &&
    selectedCount.value > 0 &&
    Boolean(sharedStatus.value) &&
    !isSubmitting.value,
);
const selectedSummaryLabel = computed(
  () => `已選 ${selectedCount.value} / ${foundItems.value.length} 筆工單`,
);
const selectedContainsSnowboard = computed(() =>
  hasAdminBulkStatusSelectedSnowboards(foundItems.value, selectedPaperOrderNos.value),
);
const showSnowboardDryingWarning = computed(
  () => isPreviewReady.value && sharedStatus.value === 'DRYING' && selectedContainsSnowboard.value,
);
const previewWorkOrderIds = computed(() => foundItems.value.map((item) => item.id));
const recentBatchUpdatedWorkOrderIds = computed(() =>
  recentBatchResult.value?.updated.map((item) => item.workOrderId) ?? [],
);
const trackedPrintSummaryWorkOrderIds = computed(() => {
  const ids = new Set<string>();

  for (const workOrderId of previewWorkOrderIds.value) {
    ids.add(workOrderId);
  }

  for (const workOrderId of recentBatchUpdatedWorkOrderIds.value) {
    ids.add(workOrderId);
  }

  return Array.from(ids);
});
const notFoundCopyText = computed(() => notFoundPaperOrderNos.value.join('\n'));
const sharedSubmitLabel = computed(() =>
  isSubmitting.value
    ? `批量更新中（${submittingSelectedSnapshot.value.length} 筆）`
    : '批量更新',
);
const submitFieldErrors = computed<Record<string, string[]>>(() => {
  const mergedErrors: Record<string, string[]> = {};
  const serverFieldErrors = submitApiError.value?.error.fieldErrors ?? {};

  for (const [field, messages] of Object.entries(serverFieldErrors)) {
    mergedErrors[field] = [...messages];
  }

  for (const [field, messages] of Object.entries(submitClientFieldErrors.value)) {
    mergedErrors[field] = [...(mergedErrors[field] ?? []), ...messages];
  }

  return mergedErrors;
});
const submitFormAlertMessages = computed(() => {
  const messages = new Set<string>();
  const fieldErrors = submitApiError.value?.error.fieldErrors ?? {};

  for (const [field, fieldMessages] of Object.entries(fieldErrors)) {
    if (field === 'body' || !['paperOrderNos', 'status', 'note'].includes(field)) {
      for (const message of fieldMessages) {
        messages.add(message);
      }
    }
  }

  if (submitApiError.value && messages.size === 0 && Object.keys(fieldErrors).length === 0) {
    messages.add(submitApiError.value.error.message);
  }

  return Array.from(messages);
});

const chunkWorkOrderIds = (workOrderIds: string[], chunkSize = 50) => {
  const chunks: string[][] = [];

  for (let index = 0; index < workOrderIds.length; index += chunkSize) {
    chunks.push(workOrderIds.slice(index, index + chunkSize));
  }

  return chunks;
};

const clearSubmitFeedback = () => {
  submitClientFieldErrors.value = {};
  submitApiError.value = null;
};

const resetGroupExpandedState = () => {
  for (const status of ADMIN_BULK_STATUS_GROUP_ORDER) {
    groupExpandedState[status] = true;
  }
};

const resetPreviewState = () => {
  foundItems.value = [];
  notFoundPaperOrderNos.value = [];
  selectedPaperOrderNos.value = [];
  previewStatus.value = 'idle';
  previewErrorMessage.value = null;
  inputFieldErrors.value = {};
  clearSubmitFeedback();
  resetGroupExpandedState();
};

const clearBulkInput = () => {
  bulkInput.value = '';
  sharedStatus.value = '';
  sharedNote.value = '';
  resetPreviewState();
};

const applyPreviewResult = (result: {
  found: AdminWorkOrderResolveItem[];
  notFound: string[];
}) => {
  foundItems.value = result.found;
  notFoundPaperOrderNos.value = result.notFound;
  selectedPaperOrderNos.value = result.found.map((item) => item.paperOrderNo);
  previewStatus.value = 'ready';
  previewErrorMessage.value = null;
  inputFieldErrors.value = {};
  clearSubmitFeedback();
  resetGroupExpandedState();
};

const handleAuthRedirect = async (error: unknown) => {
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

const fetchPrintSummaryMap = async (workOrderIds: string[]) => {
  const dedupedIds = Array.from(new Set(workOrderIds.filter((value) => value.trim() !== '')));

  if (dedupedIds.length === 0) {
    return {} as Record<string, AdminPrintSummaryItem>;
  }

  const summaryMap: Record<string, AdminPrintSummaryItem> = {};

  for (const chunk of chunkWorkOrderIds(dedupedIds)) {
    const response = await getRequestFetch()<AdminPrintSummaryResponse>('/api/admin/print-summaries', {
      query: {
        workOrderId: chunk,
      },
    });

    for (const workOrderId of chunk) {
      summaryMap[workOrderId] =
        response.data[workOrderId] ?? createEmptyAdminPrintSummary(workOrderId);
    }
  }

  return summaryMap;
};

const refreshPreviewPrintSummaries = async () => {
  try {
    previewPrintSummaries.value = await fetchPrintSummaryMap(previewWorkOrderIds.value);
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    console.error('Failed to refresh preview print summaries', error);
  }
};

const refreshRecentBatchPrintSummaries = async () => {
  try {
    recentBatchPrintSummaries.value = await fetchPrintSummaryMap(recentBatchUpdatedWorkOrderIds.value);
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    console.error('Failed to refresh recent batch print summaries', error);
  }
};

const getPreviewPrintSummary = (workOrderId: string) =>
  previewPrintSummaries.value[workOrderId] ?? createEmptyAdminPrintSummary(workOrderId);

const getRecentBatchPrintSummary = (workOrderId: string) =>
  recentBatchPrintSummaries.value[workOrderId] ?? createEmptyAdminPrintSummary(workOrderId);

const isReprintingWorkOrder = (workOrderId: string) =>
  reprintingWorkOrderIds.value.includes(workOrderId);

const createPrintJobFromBulkResult = async (workOrderId: string) => {
  if (isReprintingWorkOrder(workOrderId)) {
    return;
  }

  reprintingWorkOrderIds.value = [...reprintingWorkOrderIds.value, workOrderId];

  try {
    await getRequestFetch()('/api/admin/print-jobs', {
      body: {
        jobType: 'work_order_label',
        workOrderId,
      },
      method: 'POST',
    });

    toast.success(`${getAdminPrintActionLabel(getRecentBatchPrintSummary(workOrderId))}已送出`);
    await Promise.all([refreshPreviewPrintSummaries(), refreshRecentBatchPrintSummaries()]);
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    const apiEnvelope = extractApiErrorEnvelope(error);
    toast.error('建立列印任務失敗。', {
      description: apiEnvelope?.error.message ?? '請稍後再試。',
    });
  } finally {
    reprintingWorkOrderIds.value = reprintingWorkOrderIds.value.filter((id) => id !== workOrderId);
  }
};

const resolveWorkOrder = async (paperOrderNo: string) => {
  const response = await getRequestFetch()<AdminWorkOrderResolveResponse>(
    '/api/admin/work-orders/resolve',
    {
      query: {
        paperOrderNo,
      },
    },
  );

  return response.data;
};

const refreshPreviewFromCurrentInput = async () => {
  const result = await resolveAdminBulkStatusPreview(parsedPaperOrderNos.value, resolveWorkOrder);
  applyPreviewResult(result);
};

const runPreviewSearch = async () => {
  const paperOrderNos = parsedPaperOrderNos.value;

  inputFieldErrors.value = {};
  previewErrorMessage.value = null;

  if (paperOrderNos.length === 0) {
    inputFieldErrors.value = {
      bulkInput: ['請至少輸入一筆工單號。'],
    };
    return;
  }

  previewStatus.value = 'loading';

  try {
    const result = await resolveAdminBulkStatusPreview(paperOrderNos, resolveWorkOrder);
    applyPreviewResult(result);
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    previewErrorMessage.value =
      extractApiErrorEnvelope(error)?.error.message ?? '目前無法搜尋工單，請稍後再試。';
    previewStatus.value = hasPreviewResults.value ? 'stale' : 'idle';
  }
};

const isPaperOrderSelected = (paperOrderNo: string) =>
  selectedPaperOrderNos.value.includes(paperOrderNo);

const updatePaperOrderSelection = (paperOrderNo: string, checked: boolean) => {
  if (isSubmitting.value) {
    return;
  }

  if (checked) {
    if (isPaperOrderSelected(paperOrderNo)) {
      return;
    }

    selectedPaperOrderNos.value = [...selectedPaperOrderNos.value, paperOrderNo];
    return;
  }

  selectedPaperOrderNos.value = selectedPaperOrderNos.value.filter((value) => value !== paperOrderNo);
};

const toggleGroupExpanded = (status: WorkOrderStatus) => {
  groupExpandedState[status] = !groupExpandedState[status];
};

const copyNotFoundPaperOrderNos = async () => {
  if (!notFoundCopyText.value) {
    return;
  }

  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API unavailable');
    }

    await navigator.clipboard.writeText(notFoundCopyText.value);
    toast.success('錯誤單號已複製');
  } catch {
    toast.error('目前無法複製錯誤單號');
  }
};

const handleSharedStatusChange = (value: unknown) => {
  if (typeof value === 'string' && statusValues.has(value as WorkOrderStatus)) {
    sharedStatus.value = value as WorkOrderStatus;
    return;
  }

  sharedStatus.value = '';
};

const submitBulkStatusUpdate = async (
  selectedForSubmit: string[],
  targetStatus: WorkOrderStatus | '',
) => {
  clearSubmitFeedback();

  const orderedPaperOrderNos = getAdminBulkStatusSelectedPaperOrderNos(
    foundItems.value,
    selectedForSubmit,
  );
  const { fieldErrors, payload } = buildAdminBulkStatusSubmitPayload(
    orderedPaperOrderNos,
    targetStatus,
    sharedNote.value,
  );

  if (!payload) {
    submitClientFieldErrors.value = fieldErrors;
    return;
  }

  isSubmitting.value = true;
  submittingSelectedSnapshot.value = [...payload.paperOrderNos];

  try {
    const response = await getRequestFetch()<AdminWorkOrderBulkStatusResponse>(
      '/api/admin/work-orders/bulk-status',
      {
        body: payload,
        method: 'POST',
      },
    );

    recentBatchResult.value = response.data;
    toast.success(`已更新 ${response.data.updatedCount} 筆，略過 ${response.data.skippedCount} 筆`);

    try {
      await refreshPreviewFromCurrentInput();
    } catch (previewRefreshError) {
      if (await handleAuthRedirect(previewRefreshError)) {
        return;
      }

      previewStatus.value = 'stale';
      previewErrorMessage.value = '批量更新成功，但重新整理搜尋結果失敗，請重新搜尋。';
    }

    sharedStatus.value = '';
    sharedNote.value = '';

    await nextTick();
    recentBatchResultElement.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    submitApiError.value = extractApiErrorEnvelope(error);
    toast.error('批量更新失敗');
  } finally {
    isSubmitting.value = false;
    submittingSelectedSnapshot.value = [];
  }
};

const submitSharedBulkStatusUpdate = async () => {
  await submitBulkStatusUpdate(selectedPaperOrderNos.value, sharedStatus.value);
};

const submitGroupQuickAction = async (group: (typeof previewGroups.value)[number]) => {
  if (!group.nextStatus) {
    return;
  }

  const selectedPaperOrderNosForGroup = group.items
    .map((item) => item.paperOrderNo)
    .filter((paperOrderNo) => selectedPaperOrderNos.value.includes(paperOrderNo));

  await submitBulkStatusUpdate(selectedPaperOrderNosForGroup, group.nextStatus);
};

watch(bulkInput, (nextValue, previousValue) => {
  if (nextValue === previousValue) {
    return;
  }

  inputFieldErrors.value = {};
  previewErrorMessage.value = null;

  if (previewStatus.value === 'ready' || previewStatus.value === 'stale') {
    previewStatus.value = 'stale';
  }
});

watch(
  previewWorkOrderIds,
  () => {
    void refreshPreviewPrintSummaries();
  },
  { immediate: true },
);

watch(
  recentBatchUpdatedWorkOrderIds,
  () => {
    void refreshRecentBatchPrintSummaries();
  },
  { immediate: true },
);

useAdminPrintingRealtime({
  onRefresh: async () => {
    await Promise.all([refreshPreviewPrintSummaries(), refreshRecentBatchPrintSummaries()]);
  },
  shouldRefreshFromEvent: (payload) =>
    !payload.workOrderId || trackedPrintSummaryWorkOrderIds.value.includes(payload.workOrderId),
  topics: ['printing:jobs'],
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Bulk status</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">批量狀態更新</h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            一次輸入多筆紙本工單號，先 preview 搜尋，再用共享狀態或各組快捷按鈕批量推進工單。
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card>
        <CardHeader>
          <CardTitle>批量輸入</CardTitle>
          <CardDescription>支援換行、逗號與空白分隔；會依首次出現順序去重。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <Field>
            <FieldLabel for="bulk-paper-order-input">紙本工單號</FieldLabel>
            <Textarea
              id="bulk-paper-order-input"
              v-model="bulkInput"
              :disabled="isInputLocked"
              class="min-h-36"
              placeholder="例如&#10;BR-2026-0001&#10;BR-2026-0002, BR-2026-0003"
            />
            <FieldDescription>
              共解析 {{ parsedPaperOrderNos.length }} 筆唯一工單號。
            </FieldDescription>
            <FieldError :errors="inputFieldErrors.bulkInput" />
          </Field>

          <Alert v-if="isPreviewStale">
            <AlertTitle>搜尋結果已過期</AlertTitle>
            <AlertDescription>輸入已變更，請重新搜尋後再進行批量操作。</AlertDescription>
          </Alert>

          <Alert v-if="previewErrorMessage" variant="destructive">
            <AlertTitle>搜尋工單失敗</AlertTitle>
            <AlertDescription>{{ previewErrorMessage }}</AlertDescription>
          </Alert>

          <div class="flex flex-col gap-2 sm:flex-row">
            <Button
              :disabled="!canRunPreviewSearch"
              type="button"
              class="sm:min-w-28"
              @click="runPreviewSearch"
            >
              <Spinner v-if="isPreviewLoading" class="mr-2" />
              搜尋
            </Button>
            <Button
              :disabled="isInputLocked"
              type="button"
              variant="outline"
              class="sm:min-w-28"
              @click="clearBulkInput"
            >
              清除
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>批量操作</CardTitle>
          <CardDescription>
            {{ selectedSummaryLabel }}；共享狀態會作用於所有目前已選工單。
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <FieldError :errors="submitFieldErrors.paperOrderNos" />

          <Field>
            <FieldLabel for="bulk-target-status">目標狀態</FieldLabel>
            <Select
              :disabled="!isPreviewReady || isSubmitting"
              :model-value="sharedStatus"
              @update:model-value="handleSharedStatusChange"
            >
              <SelectTrigger id="bulk-target-status" class="w-full">
                <SelectValue placeholder="選擇共享狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ADMIN_WORK_ORDER_STATUS_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError :errors="submitFieldErrors.status" />
          </Field>

          <Field>
            <FieldLabel for="bulk-note">共用備註</FieldLabel>
            <Textarea
              id="bulk-note"
              v-model="sharedNote"
              :disabled="!isPreviewReady || isSubmitting"
              class="min-h-28"
              placeholder="例如 今日統一開工"
            />
            <FieldDescription>會帶進所有共享操作與各組快捷操作。</FieldDescription>
            <FieldError :errors="submitFieldErrors.note" />
          </Field>

          <Alert v-if="showSnowboardDryingWarning">
            <AlertTitle>雪板會被略過</AlertTitle>
            <AlertDescription>雪板不支援推進到除濕中，送出後會被略過。</AlertDescription>
          </Alert>

          <Alert v-if="submitFormAlertMessages.length > 0" variant="destructive">
            <AlertTitle>批量更新失敗</AlertTitle>
            <AlertDescription class="space-y-1">
              <p v-for="message in submitFormAlertMessages" :key="message">{{ message }}</p>
            </AlertDescription>
          </Alert>

          <Button
            :disabled="!canRunSharedBulkAction"
            type="button"
            class="w-full"
            @click="submitSharedBulkStatusUpdate"
          >
            <Spinner v-if="isSubmitting" class="mr-2" />
            {{ sharedSubmitLabel }}
          </Button>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold tracking-tight">搜尋結果</h2>
        <p class="text-sm text-muted-foreground">
          依目前狀態分組；找到的工單預設全選，可逐筆排除。
        </p>
      </div>

      <template v-if="isPreviewLoading">
        <Card v-for="index in 2" :key="`bulk-preview-skeleton-${index}`">
          <CardHeader>
            <Skeleton class="h-5 w-32" />
            <Skeleton class="h-4 w-40" />
          </CardHeader>
          <CardContent class="space-y-3">
            <Skeleton class="h-16 w-full" />
            <Skeleton class="h-16 w-full" />
          </CardContent>
        </Card>
      </template>

      <template v-else-if="!hasPreviewResults">
        <Card>
          <CardHeader>
            <CardTitle>尚未建立 preview</CardTitle>
            <CardDescription>貼上多筆紙本工單號後，按搜尋取得可更新的工單清單。</CardDescription>
          </CardHeader>
        </Card>
      </template>

      <template v-else>
        <Card
          v-for="group in previewGroups"
          :key="group.key"
          class="overflow-hidden"
        >
          <CardHeader class="gap-3">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <CardTitle class="text-base">{{ group.label }}</CardTitle>
                  <Badge variant="secondary">{{ group.totalCount }} 筆</Badge>
                  <Badge variant="outline">已選 {{ group.selectedCount }} 筆</Badge>
                </div>
                <CardDescription>
                  這組工單會保持原始輸入順序，方便核對掃描或貼上的紙本工單號。
                </CardDescription>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <Button
                  v-if="group.nextStatus"
                  :disabled="!isPreviewReady || isSubmitting || group.selectedCount === 0"
                  size="sm"
                  type="button"
                  variant="outline"
                  @click="submitGroupQuickAction(group)"
                >
                  → {{ getWorkOrderStatusLabel(group.nextStatus) }}（{{ group.selectedCount }} 筆）
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  @click="toggleGroupExpanded(group.key)"
                >
                  {{ groupExpandedState[group.key] ? '收合' : '展開' }}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent v-if="groupExpandedState[group.key]" class="space-y-3">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="rounded-lg border p-4"
            >
              <div class="flex items-start gap-3">
                <Checkbox
                  :disabled="isSubmitting"
                  :model-value="isPaperOrderSelected(item.paperOrderNo)"
                  class="mt-0.5"
                  @update:model-value="
                    (value) => updatePaperOrderSelection(item.paperOrderNo, Boolean(value))
                  "
                />

                <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div class="space-y-1">
                      <p class="font-medium">{{ item.paperOrderNo }}</p>
                      <p class="text-sm text-muted-foreground">
                        {{ item.customer.name ?? '—' }}
                      </p>
                    </div>
                    <WorkOrderStatusBadge :status="item.currentStatus" />
                  </div>

                  <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">顧客手機</span>
                      <span class="text-foreground">{{ item.customer.phone ?? '—' }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">板型</span>
                      <span class="text-foreground">{{ getBoardTypeLabel(item.board.boardType) }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">長度分類</span>
                      <span class="text-foreground">
                        {{ getBoardLengthClassLabel(item.board.boardLengthClass) }}
                      </span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">尺寸</span>
                      <span class="text-foreground">{{ item.board.sizeLabel ?? '—' }}</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">顏色</span>
                      <WorkOrderBoardColorSwatch :color="item.board.color" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">預估完成日</span>
                      <span class="text-foreground">
                        {{ formatAdminDate(item.estimatedCompletionDate) }}
                      </span>
                    </div>
                    <div class="flex flex-col gap-1 xl:col-span-2">
                      <span class="text-muted-foreground">提醒</span>
                      <WorkOrderFlagBadges :flags="item.flags" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-muted-foreground">最近更新</span>
                      <span class="text-foreground">{{ formatAdminDateTime(item.lastUpdatedAt) }}</span>
                    </div>
                  </div>

                  <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="space-y-1">
                        <p class="text-muted-foreground">列印摘要</p>
                        <PrintJobStatusBadge
                          v-if="getPreviewPrintSummary(item.id).latestJob"
                          :status="getPreviewPrintSummary(item.id).latestJob!.status"
                        />
                        <p v-else class="font-medium">尚未建立列印任務</p>
                      </div>
                      <Button as-child size="sm" type="button" variant="outline">
                        <NuxtLink :to="getAdminPrintingCenterPath(item.paperOrderNo)">
                          前往列印中心
                        </NuxtLink>
                      </Button>
                    </div>

                    <p class="mt-2 text-muted-foreground">
                      {{
                        getPreviewPrintSummary(item.id).latestJob
                          ? `最近更新 ${formatAdminDateTime(getPreviewPrintSummary(item.id).latestJob!.updatedAt)}`
                          : '目前可在列印中心或 detail 頁手動建立第一筆列印任務。'
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card v-if="notFoundPaperOrderNos.length > 0">
          <CardHeader class="gap-3">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>查無工單</CardTitle>
                <CardDescription>這些單號不會進入可更新集合，請回頭檢查輸入是否正確。</CardDescription>
              </div>
              <Button size="sm" type="button" variant="outline" @click="copyNotFoundPaperOrderNos">
                複製錯誤單號
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="paperOrderNo in notFoundPaperOrderNos"
                :key="paperOrderNo"
                variant="outline"
              >
                {{ paperOrderNo }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>

    <div
      v-if="recentBatchResult"
      :id="BULK_STATUS_RESULT_SECTION_ID"
      ref="recentBatchResultElement"
    >
      <Card>
      <CardHeader>
        <CardTitle>最近一次批量結果</CardTitle>
        <CardDescription>
          requested {{ recentBatchResult.requestedCount }} / deduped {{ recentBatchResult.dedupedCount }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="rounded-lg border p-3">
            <p class="text-sm text-muted-foreground">成功更新</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentBatchResult.updatedCount }}</p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-sm text-muted-foreground">略過</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentBatchResult.skippedCount }}</p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-sm text-muted-foreground">原始輸入</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentBatchResult.requestedCount }}</p>
          </div>
          <div class="rounded-lg border p-3">
            <p class="text-sm text-muted-foreground">去重後</p>
            <p class="mt-2 text-2xl font-semibold">{{ recentBatchResult.dedupedCount }}</p>
          </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-2">
          <div class="space-y-3">
            <h3 class="text-sm font-medium">已更新</h3>
            <div v-if="recentBatchResult.updated.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              本次沒有成功更新的工單。
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in recentBatchResult.updated"
                :key="item.statusHistoryId"
                class="rounded-lg border p-3 text-sm"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1">
                    <span class="font-medium">{{ item.paperOrderNo }}</span>
                    <p class="break-all text-muted-foreground">workOrderId: {{ item.workOrderId }}</p>
                  </div>
                  <WorkOrderStatusBadge :status="item.currentStatus" />
                </div>

                <div class="mt-3 rounded-lg border bg-muted/20 px-3 py-3">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="space-y-1">
                      <p class="text-muted-foreground">列印摘要</p>
                      <PrintJobStatusBadge
                        v-if="getRecentBatchPrintSummary(item.workOrderId).latestJob"
                        :status="getRecentBatchPrintSummary(item.workOrderId).latestJob!.status"
                      />
                      <p v-else class="font-medium">尚未建立列印任務</p>
                    </div>

                    <div class="flex flex-wrap gap-2">
                      <Button as-child size="sm" type="button" variant="outline">
                        <NuxtLink :to="getAdminPrintingCenterPath(item.paperOrderNo)">
                          前往列印中心
                        </NuxtLink>
                      </Button>
                      <Button
                        v-if="getRecentBatchPrintSummary(item.workOrderId).reprintAllowed"
                        size="sm"
                        type="button"
                        :disabled="isReprintingWorkOrder(item.workOrderId)"
                        @click="createPrintJobFromBulkResult(item.workOrderId)"
                      >
                        <Spinner
                          v-if="isReprintingWorkOrder(item.workOrderId)"
                          data-icon="inline-start"
                        />
                        {{ getAdminPrintActionLabel(getRecentBatchPrintSummary(item.workOrderId)) }}
                      </Button>
                    </div>
                  </div>

                  <p class="mt-2 text-muted-foreground">
                    {{
                      getRecentBatchPrintSummary(item.workOrderId).latestJob
                        ? `最近更新 ${formatAdminDateTime(getRecentBatchPrintSummary(item.workOrderId).latestJob!.updatedAt)}`
                        : '尚未建立列印任務，可直接建立第一筆標籤列印。'
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <h3 class="text-sm font-medium">已略過</h3>
            <div v-if="recentBatchResult.skipped.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              本次沒有被略過的工單。
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in recentBatchResult.skipped"
                :key="`${item.paperOrderNo}-${item.reason}`"
                class="rounded-lg border p-3 text-sm"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium">{{ item.paperOrderNo }}</span>
                  <Badge variant="outline">{{ getAdminBulkStatusSkipReasonLabel(item.reason) }}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      </Card>
    </div>
  </div>
</template>
