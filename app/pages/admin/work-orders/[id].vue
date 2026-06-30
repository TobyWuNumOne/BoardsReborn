<script setup lang="ts">
import { parseDate } from '@internationalized/date';
import { CalendarIcon, MapPinnedIcon, Trash2Icon } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { AdminLineNotificationSummary } from '~/utils/admin-line';
import { getAdminLineNotificationFeedback } from '~/utils/admin-line';
import type {
  AdminPrintSummaryItem,
  AdminPrintSummaryResponse,
  PrintJobType,
} from '~/utils/admin-printing';
import type { RepairCountSource, RepairMark } from '~/utils/repair-marks';
import {
  createEmptyAdminPrintSummary,
  getAdminPrintActionLabel,
  getAdminPrintingCenterPath,
  getPrintJobTypeLabel,
} from '~/utils/admin-printing';
import {
  ADMIN_PRINTING_ACTIVE_SUMMARY_REFRESH_INTERVAL_MS,
  isAdminPrintingActiveJobStatus,
} from '~/utils/admin-printing-realtime';
import type {
  AdminWorkOrderDetailItem,
  AdminWorkOrderDetailMode,
  AdminWorkOrderDetailResponse,
  AdminWorkOrderEditFormState,
  AdminWorkOrderEditNormalizedSnapshot,
  AdminWorkOrderWorkFormState,
  ApiErrorEnvelope,
} from '~/utils/admin-work-orders';
import {
  ADMIN_WORK_ORDER_DETAIL_MODE_OPTIONS,
  ADMIN_WORK_ORDER_STATUS_OPTIONS,
  buildAdminWorkOrderEditPatchPayload,
  buildAdminWorkOrderStatusTransitionPayload,
  createAdminWorkOrderEditFormState,
  createEmptyAdminWorkOrderEditFormState,
  createEmptyAdminWorkOrderWorkFormState,
  extractApiErrorEnvelope,
  formatAdminDate,
  formatAdminDateTime,
  getAdminWorkOrderDetailAsyncKey,
  getAdminWorkOrderDetailModeLabel,
  getBoardLengthClassLabel,
  getAdminWorkOrderEditDirtyFields,
  getApiErrorStatusCode,
  getBoardTypeLabel,
  getQuoteItemTypeLabel,
  getWorkOrderStatusMeta,
  getWorkOrderStatusLabel,
  isWorkOrderStatusBlockedForBoardType,
  normalizeAdminWorkOrderDetailRouteQuery,
  normalizeAdminWorkOrderEditFormState,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import { deriveRepairCount, summarizeRepairMarks } from '~/utils/repair-marks';
import PrintJobStatusBadge from '~/components/printing/PrintJobStatusBadge.vue';
import RepairMarksEditorDialog from '~/components/work-orders/RepairMarksEditorDialog.vue';
import RepairMarksSurfaceGallery from '~/components/work-orders/RepairMarksSurfaceGallery.vue';
import WorkOrderBoardColorSwatch from '~/components/work-orders/WorkOrderBoardColorSwatch.vue';
import WorkOrderLineStatusCard from '~/components/work-orders/WorkOrderLineStatusCard.vue';
import WorkOrderStatusBadge from '~/components/work-orders/WorkOrderStatusBadge.vue';
import { Textarea } from '~/components/ui/textarea';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

interface DetailField {
  isBoardColor?: boolean;
  label: string;
  value: string;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat('zh-TW', {
  currency: 'TWD',
  maximumFractionDigits: 0,
  style: 'currency',
});
const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
});
const LIST_ROUTE = '/admin/work-orders';
const EDIT_LEAVE_CONFIRM_MESSAGE = '目前有未儲存的變更，確定要離開編輯模式嗎？';
const EDIT_FORM_FIELD_NAMES = new Set([
  'estimatedCompletionDate',
  'damageDescription',
  'paymentReceived',
  'publicNote',
  'internalNote',
  'pickupNote',
  'storageFeeWarningAfterDays',
]);
const WORK_FORM_FIELD_NAMES = new Set(['status', 'note', 'internalNote']);

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'admin-work-order-detail-query'],
});

const route = useRoute();
const router = useRouter();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const routeWorkOrderId = computed(() => {
  const rawValue = route.params.id;

  if (Array.isArray(rawValue)) {
    return rawValue[0] ?? '';
  }

  return typeof rawValue === 'string' ? rawValue : '';
});

const detailMode = computed<AdminWorkOrderDetailMode>(
  () => normalizeAdminWorkOrderDetailRouteQuery(route.query).mode,
);
const detailAsyncKey = computed(() => getAdminWorkOrderDetailAsyncKey(routeWorkOrderId.value));

const editForm = reactive<AdminWorkOrderEditFormState>(createEmptyAdminWorkOrderEditFormState());
const lastSyncedEditSnapshot = ref<AdminWorkOrderEditNormalizedSnapshot | null>(null);
const lastSyncedWorkOrderId = ref<string | null>(null);
const shouldSyncEditFormOnNextRefresh = ref(false);
const isSubmittingEditForm = ref(false);
const isDeletingWorkOrder = ref(false);
const editEstimatedDatePopoverOpen = ref(false);
const repairMarksDialogOpen = ref(false);
const clientEditFieldErrors = ref<Record<string, string[]>>({});
const submitEditApiError = ref<ApiErrorEnvelope | null>(null);
const deleteWorkOrderApiError = ref<ApiErrorEnvelope | null>(null);
const workForm = reactive<AdminWorkOrderWorkFormState>(createEmptyAdminWorkOrderWorkFormState());
const lastWorkFormWorkOrderId = ref<string | null>(null);
const isSubmittingWorkForm = ref(false);
const clientWorkFieldErrors = ref<Record<string, string[]>>({});
const submitWorkApiError = ref<ApiErrorEnvelope | null>(null);
const isSubmittingPrintAction = ref(false);
const printActionDialogOpen = ref(false);
const submittingPrintJobType = ref<PrintJobType | null>(null);
const workOrderStatusValues = new Set(
  ADMIN_WORK_ORDER_STATUS_OPTIONS.map((option) => option.value),
);
const PRINT_JOB_CREATE_OPTIONS: Array<{ description: string; jobType: PrintJobType }> = [
  {
    description: '印現有工單標籤與 1D barcode。',
    jobType: 'work_order_label',
  },
  {
    description: '印顧客留存聯、QR Code 與取件提醒。',
    jobType: 'customer_receipt',
  },
];

const formatCurrency = (value: number | null) =>
  typeof value === 'number' ? CURRENCY_FORMATTER.format(value) : '—';

const formatNullableText = (value: string | null | undefined) => value?.trim() || '—';

const formatNullableNumber = (
  value: number | null | undefined,
  unit?: string,
  emptyLabel = '—',
) => {
  if (typeof value !== 'number') {
    return emptyLabel;
  }

  return unit ? `${value} ${unit}` : String(value);
};

const formatBooleanLabel = (
  value: boolean | null | undefined,
  trueLabel: string,
  falseLabel: string,
) => {
  if (value === true) {
    return trueLabel;
  }

  if (value === false) {
    return falseLabel;
  }

  return '—';
};

const getTaipeiTodayDateString = () => {
  const parts = TAIPEI_DATE_FORMATTER.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
};

const getSafeCalendarDate = (value: string) => {
  try {
    return parseDate(value);
  } catch {
    return parseDate(getTaipeiTodayDateString());
  }
};

const clearEditFeedback = () => {
  clientEditFieldErrors.value = {};
  submitEditApiError.value = null;
  deleteWorkOrderApiError.value = null;
};

const clearWorkFeedback = () => {
  clientWorkFieldErrors.value = {};
  submitWorkApiError.value = null;
};

const syncEditFormFromDetail = (workOrder: AdminWorkOrderDetailItem) => {
  const nextFormState = createAdminWorkOrderEditFormState(workOrder);

  Object.assign(editForm, nextFormState);
  lastSyncedEditSnapshot.value = normalizeAdminWorkOrderEditFormState(nextFormState);
  lastSyncedWorkOrderId.value = workOrder.id;
  clearEditFeedback();
};

const resetWorkForm = () => {
  Object.assign(workForm, createEmptyAdminWorkOrderWorkFormState());
  clearWorkFeedback();
};

const fetchWorkOrderDetail = async () => {
  try {
    return await getRequestFetch()<AdminWorkOrderDetailResponse>(
      `/api/admin/work-orders/${encodeURIComponent(routeWorkOrderId.value)}`,
    );
  } catch (error) {
    const statusCode = getApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return null;
    }

    throw error;
  }
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

const fetchPrintSummary = async () => {
  if (!routeWorkOrderId.value) {
    return {
      data: {},
    } satisfies AdminPrintSummaryResponse;
  }

  try {
    return await getRequestFetch()<AdminPrintSummaryResponse>('/api/admin/print-summaries', {
      query: {
        workOrderId: routeWorkOrderId.value,
      },
    });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return {
        data: {},
      } satisfies AdminPrintSummaryResponse;
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData(detailAsyncKey, fetchWorkOrderDetail, {
  lazy: true,
  watch: [routeWorkOrderId],
});
const {
  data: printSummaryResponse,
  refresh: refreshPrintSummary,
  status: printSummaryStatus,
} = await useAsyncData(
  computed(() => `admin-print-summary:${routeWorkOrderId.value}`),
  fetchPrintSummary,
  {
    lazy: true,
    watch: [routeWorkOrderId],
  },
);

const detail = computed<AdminWorkOrderDetailItem | null>(() => data.value?.data ?? null);
const printSummary = computed<AdminPrintSummaryItem | null>(() => {
  if (!routeWorkOrderId.value) {
    return null;
  }

  return (
    printSummaryResponse.value?.data?.[routeWorkOrderId.value] ??
    createEmptyAdminPrintSummary(routeWorkOrderId.value)
  );
});
const printActionLabel = computed(() => getAdminPrintActionLabel(printSummary.value));
const printCenterPath = computed(() => getAdminPrintingCenterPath(detail.value?.paperOrderNo));
const shouldShowCreatedBanner = computed(() => route.query.created === '1');
const isPrintSummaryLoading = computed(
  () => printSummaryStatus.value === 'pending' && !printSummaryResponse.value,
);
const shouldActiveRefreshPrintSummary = computed(() =>
  isAdminPrintingActiveJobStatus(printSummary.value?.latestJob?.status),
);
const detailTitle = computed(() => {
  const paperOrderNo = detail.value?.paperOrderNo;

  return paperOrderNo ? `${paperOrderNo} | 工單詳情 | BoardsReborn` : '工單詳情 | BoardsReborn';
});
const apiError = computed<ApiErrorEnvelope | null>(() => extractApiErrorEnvelope(error.value));
const apiErrorStatus = computed(() => getApiErrorStatusCode(error.value));
const isInitialLoading = computed(() => fetchStatus.value === 'pending' && !detail.value);
const isNotFound = computed(
  () =>
    fetchStatus.value === 'error' &&
    (apiErrorStatus.value === 404 || apiError.value?.error.code === 'NOT_FOUND'),
);
const isInvalidRoute = computed(
  () =>
    fetchStatus.value === 'error' &&
    !isNotFound.value &&
    (apiErrorStatus.value === 422 || apiError.value?.error.code === 'VALIDATION_ERROR'),
);
const hasGeneralError = computed(
  () => fetchStatus.value === 'error' && !isNotFound.value && !isInvalidRoute.value,
);

const currentEditSnapshot = computed(() => normalizeAdminWorkOrderEditFormState(editForm));
const editDirtyFields = computed(() =>
  lastSyncedEditSnapshot.value
    ? getAdminWorkOrderEditDirtyFields(lastSyncedEditSnapshot.value, currentEditSnapshot.value)
    : [],
);
const isEditDirty = computed(() => editDirtyFields.value.length > 0);
const canSubmitEditForm = computed(
  () =>
    detailMode.value === 'edit' &&
    isEditDirty.value &&
    !isSubmittingEditForm.value &&
    !isDeletingWorkOrder.value,
);
const hasUnsavedEditChanges = computed(
  () =>
    detailMode.value === 'edit' &&
    isEditDirty.value &&
    !isSubmittingEditForm.value &&
    !isDeletingWorkOrder.value,
);

const editFieldErrors = computed<Record<string, string[]>>(() => {
  const mergedErrors: Record<string, string[]> = {};
  const serverFieldErrors = submitEditApiError.value?.error.fieldErrors ?? {};

  for (const [field, messages] of Object.entries(serverFieldErrors)) {
    mergedErrors[field] = [...messages];
  }

  for (const [field, messages] of Object.entries(clientEditFieldErrors.value)) {
    mergedErrors[field] = [...(mergedErrors[field] ?? []), ...messages];
  }

  return mergedErrors;
});

const editFormAlertMessages = computed(() => {
  const messages = new Set<string>();
  const fieldErrors = submitEditApiError.value?.error.fieldErrors ?? {};

  for (const [field, fieldMessages] of Object.entries(fieldErrors)) {
    if (field === 'body' || !EDIT_FORM_FIELD_NAMES.has(field)) {
      for (const message of fieldMessages) {
        messages.add(message);
      }
    }
  }

  if (submitEditApiError.value && messages.size === 0 && Object.keys(fieldErrors).length === 0) {
    messages.add(submitEditApiError.value.error.message);
  }

  if (deleteWorkOrderApiError.value) {
    messages.add(deleteWorkOrderApiError.value.error.message);
  }

  return Array.from(messages);
});

const workFieldErrors = computed<Record<string, string[]>>(() => {
  const mergedErrors: Record<string, string[]> = {};
  const serverFieldErrors = submitWorkApiError.value?.error.fieldErrors ?? {};

  for (const [field, messages] of Object.entries(serverFieldErrors)) {
    mergedErrors[field] = [...messages];
  }

  for (const [field, messages] of Object.entries(clientWorkFieldErrors.value)) {
    mergedErrors[field] = [...(mergedErrors[field] ?? []), ...messages];
  }

  return mergedErrors;
});

const workFormAlertMessages = computed(() => {
  const messages = new Set<string>();
  const fieldErrors = submitWorkApiError.value?.error.fieldErrors ?? {};

  for (const [field, fieldMessages] of Object.entries(fieldErrors)) {
    if (field === 'body' || !WORK_FORM_FIELD_NAMES.has(field)) {
      for (const message of fieldMessages) {
        messages.add(message);
      }
    }
  }

  if (submitWorkApiError.value && messages.size === 0 && Object.keys(fieldErrors).length === 0) {
    messages.add(submitWorkApiError.value.error.message);
  }

  return Array.from(messages);
});

const canSubmitWorkForm = computed(
  () => detailMode.value === 'work' && Boolean(workForm.status) && !isSubmittingWorkForm.value,
);
const canDeleteWorkOrder = computed(
  () =>
    detailMode.value === 'edit' &&
    detail.value?.currentStatus === 'RECEIVED' &&
    !isSubmittingEditForm.value &&
    !isDeletingWorkOrder.value,
);
const currentStatusMeta = computed(() =>
  detail.value?.currentStatus ? getWorkOrderStatusMeta(detail.value.currentStatus) : null,
);
const detailRepairMarksSummary = computed(() =>
  detail.value
    ? summarizeRepairMarks(detail.value.repairMarks)
    : { backCount: 0, frontCount: 0, totalCount: 0 },
);
const editRepairCountMismatch = computed(() => {
  if (editForm.repairCountSource !== 'manual' || !editForm.repairCount) {
    return false;
  }

  return Number.parseInt(editForm.repairCount, 10) !== editForm.repairMarks.length;
});

const headerTitle = computed(
  () => detail.value?.paperOrderNo ?? routeWorkOrderId.value ?? '工單詳情',
);
const headerSubtitle = computed(() => {
  if (detailMode.value === 'edit') {
    return '編輯既有 PATCH 白名單欄位；狀態、顧客與板子快照維持只讀。';
  }

  if (detailMode.value === 'work') {
    return '用現場作業模式直接追加狀態歷史並同步更新最新狀態。';
  }

  return '查看工單摘要、顧客、板子、報價、取件資訊與狀態歷史。';
});

useAdminPrintingRealtime({
  onRefresh: async () => {
    await refreshPrintSummary();
  },
  shouldRefreshFromEvent: (payload) =>
    !payload.workOrderId || payload.workOrderId === routeWorkOrderId.value,
  topics: ['printing:jobs'],
});

let activePrintSummaryRefreshTimer: number | null = null;

const clearActivePrintSummaryRefreshTimer = () => {
  if (activePrintSummaryRefreshTimer !== null) {
    window.clearInterval(activePrintSummaryRefreshTimer);
    activePrintSummaryRefreshTimer = null;
  }
};

const syncActivePrintSummaryRefreshTimer = () => {
  if (!import.meta.client) {
    return;
  }

  clearActivePrintSummaryRefreshTimer();

  if (!shouldActiveRefreshPrintSummary.value) {
    return;
  }

  activePrintSummaryRefreshTimer = window.setInterval(() => {
    if (document.hidden || isSubmittingPrintAction.value) {
      return;
    }

    void refreshPrintSummary();
  }, ADMIN_PRINTING_ACTIVE_SUMMARY_REFRESH_INTERVAL_MS);
};

watch(
  shouldActiveRefreshPrintSummary,
  () => {
    syncActivePrintSummaryRefreshTimer();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearActivePrintSummaryRefreshTimer();
});

const editEstimatedCalendarValue = computed({
  get: () =>
    getSafeCalendarDate(
      editForm.estimatedCompletionDate || detail.value?.intakeDate || getTaipeiTodayDateString(),
    ),
  set: (value) => {
    if (!value) {
      return;
    }

    editForm.estimatedCompletionDate = value.toString();
    editEstimatedDatePopoverOpen.value = false;
    handleEditFieldInput();
  },
});

useHead({
  title: detailTitle,
});

watch(
  detail,
  (nextDetail) => {
    if (!nextDetail) {
      return;
    }

    if (
      shouldSyncEditFormOnNextRefresh.value ||
      !lastSyncedEditSnapshot.value ||
      nextDetail.id !== lastSyncedWorkOrderId.value
    ) {
      syncEditFormFromDetail(nextDetail);
      shouldSyncEditFormOnNextRefresh.value = false;
    }

    if (nextDetail.id !== lastWorkFormWorkOrderId.value) {
      resetWorkForm();
      lastWorkFormWorkOrderId.value = nextDetail.id;
    }
  },
  { immediate: true },
);

const summaryFields = computed<DetailField[]>(() => {
  if (!detail.value) {
    return [];
  }

  return [
    {
      label: '收件日',
      value: formatAdminDate(detail.value.intakeDate),
    },
    {
      label: '預估完成日',
      value: formatAdminDate(detail.value.estimatedCompletionDate),
    },
    {
      label: '付款狀態',
      value: formatBooleanLabel(detail.value.paymentReceived, '已收款', '未收款'),
    },
    {
      label: '收款時間',
      value: formatAdminDateTime(detail.value.paymentReceivedAt),
    },
  ];
});

const customerFields = computed<DetailField[]>(() => {
  if (!detail.value) {
    return [];
  }

  return [
    {
      label: '顧客姓名',
      value: formatNullableText(detail.value.customer.name),
    },
    {
      label: '聯絡電話',
      value: formatNullableText(detail.value.customer.phone),
    },
  ];
});

const boardFields = computed<DetailField[]>(() => {
  if (!detail.value) {
    return [];
  }

  return [
    {
      label: '板型',
      value: getBoardTypeLabel(detail.value.board.boardType),
    },
    {
      label: '長度分類',
      value: getBoardLengthClassLabel(detail.value.board.boardLengthClass),
    },
    {
      label: '品牌',
      value: formatNullableText(detail.value.board.brand),
    },
    {
      label: '型號',
      value: formatNullableText(detail.value.board.model),
    },
    {
      label: '尺寸',
      value: formatNullableText(detail.value.board.sizeLabel),
    },
    {
      label: '顏色',
      value: formatNullableText(detail.value.board.color),
      isBoardColor: true,
    },
    {
      label: '序號 / 標記',
      value: formatNullableText(detail.value.board.serialLabel),
    },
  ];
});

const pickupFields = computed<DetailField[]>(() => {
  if (!detail.value) {
    return [];
  }

  return [
    {
      label: '通知取件時間',
      value: formatAdminDateTime(detail.value.pickupInfo.notifiedAt),
    },
    {
      label: '實際取件時間',
      value: formatAdminDateTime(detail.value.pickupInfo.pickedUpAt),
    },
    {
      label: '等待取件天數',
      value: formatNullableNumber(detail.value.pickupInfo.daysWaitingForPickup, '天'),
    },
    {
      label: '提醒門檻',
      value: formatNullableNumber(detail.value.pickupInfo.storageFeeWarningAfterDays, '天'),
    },
    {
      label: '是否超時',
      value: formatBooleanLabel(detail.value.pickupInfo.isPickupOverdue, '是', '否'),
    },
  ];
});

const detailNoteFields = computed<DetailField[]>(() => {
  if (!detail.value) {
    return [];
  }

  return [
    {
      label: '損傷描述',
      value: formatNullableText(detail.value.damageDescription),
    },
    {
      label: '公開備註',
      value: formatNullableText(detail.value.publicNote),
    },
    {
      label: '內部備註',
      value: formatNullableText(detail.value.internalNote),
    },
  ];
});

const confirmDiscardEditChanges = () => {
  if (!import.meta.client || !hasUnsavedEditChanges.value) {
    return true;
  }

  return window.confirm(EDIT_LEAVE_CONFIRM_MESSAGE);
};

const replaceDetailMode = async (nextMode: AdminWorkOrderDetailMode) => {
  const scrollPosition = import.meta.client
    ? {
        left: window.scrollX,
        top: window.scrollY,
      }
    : null;

  await router.replace({
    hash: route.hash,
    path: route.path,
    query: {
      mode: nextMode,
    },
  });

  if (import.meta.client && scrollPosition) {
    await nextTick();
    window.scrollTo(scrollPosition.left, scrollPosition.top);
  }
};

const switchMode = async (nextMode: AdminWorkOrderDetailMode) => {
  if (nextMode === detailMode.value) {
    return;
  }

  await replaceDetailMode(nextMode);
};

const resetEditForm = () => {
  if (!detail.value) {
    return;
  }

  editEstimatedDatePopoverOpen.value = false;
  syncEditFormFromDetail(detail.value);
};

const handleEditFieldInput = () => {
  clearEditFeedback();
};

const handlePaymentReceivedChange = (nextValue: boolean | 'indeterminate') => {
  editForm.paymentReceived = nextValue === true;
  clearEditFeedback();
};

const openRepairMarksDialog = () => {
  if (!detail.value?.board.boardType) {
    return;
  }

  repairMarksDialogOpen.value = true;
  clearEditFeedback();
};

const handleRepairMarksSave = (payload: {
  repairCount: string;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
}) => {
  editForm.repairMarks = payload.repairMarks;
  editForm.repairCountSource = payload.repairCountSource;
  editForm.repairCount =
    payload.repairCountSource === 'auto'
      ? (() => {
          const derivedCount = deriveRepairCount(payload.repairMarks);
          return derivedCount === null ? '' : String(derivedCount);
        })()
      : payload.repairCount;
  clearEditFeedback();
};

const handleWorkFieldInput = () => {
  clearWorkFeedback();
};

const handleWorkStatusChange = (value: unknown) => {
  if (
    typeof value === 'string' &&
    workOrderStatusValues.has(value as (typeof ADMIN_WORK_ORDER_STATUS_OPTIONS)[number]['value'])
  ) {
    workForm.status = value as AdminWorkOrderWorkFormState['status'];
  } else {
    workForm.status = '';
  }

  clearWorkFeedback();
};

const submitEditForm = async () => {
  if (
    !detail.value ||
    !lastSyncedEditSnapshot.value ||
    isSubmittingEditForm.value ||
    !isEditDirty.value
  ) {
    return;
  }

  clearEditFeedback();

  const { fieldErrors, payload } = buildAdminWorkOrderEditPatchPayload(
    lastSyncedEditSnapshot.value,
    currentEditSnapshot.value,
  );

  if (Object.keys(fieldErrors).length > 0) {
    clientEditFieldErrors.value = fieldErrors;
    toast.error('請先修正表單欄位。');
    return;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  isSubmittingEditForm.value = true;

  try {
    await getRequestFetch()<{
      data: {
        id: string;
        updatedAt: string;
      };
    }>(`/api/admin/work-orders/${encodeURIComponent(routeWorkOrderId.value)}`, {
      body: payload,
      method: 'PATCH',
    });

    shouldSyncEditFormOnNextRefresh.value = true;
    await refresh();

    if (fetchStatus.value !== 'success' || !detail.value) {
      toast.error('工單已更新，但重新載入最新資料失敗。');
      return;
    }

    toast.success('工單已更新。');
    await replaceDetailMode('view');
  } catch (submitError) {
    const statusCode = getApiErrorStatusCode(submitError);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return;
    }

    submitEditApiError.value = extractApiErrorEnvelope(submitError);
    toast.error('更新工單失敗。', {
      description: submitEditApiError.value?.error.message ?? '請稍後再試。',
    });
  } finally {
    isSubmittingEditForm.value = false;
  }
};

const deleteWorkOrder = async () => {
  if (!detail.value || isDeletingWorkOrder.value || !import.meta.client) {
    return;
  }

  const dirtyWarning = isEditDirty.value ? '目前未儲存的管理修正也會一併放棄。\n' : '';
  const confirmed = window.confirm(
    `${dirtyWarning}確定要刪除工單「${detail.value.paperOrderNo ?? routeWorkOrderId.value}」？刪除後會移除這張工單與關聯紀錄，但不刪除顧客資料。`,
  );

  if (!confirmed) {
    return;
  }

  clearEditFeedback();
  isDeletingWorkOrder.value = true;

  try {
    await getRequestFetch()<{
      data: {
        deletedAt: string;
        id: string;
        paperOrderNo: string;
      };
    }>(`/api/admin/work-orders/${encodeURIComponent(routeWorkOrderId.value)}`, {
      method: 'DELETE',
    });

    lastSyncedEditSnapshot.value = currentEditSnapshot.value;
    toast.success('工單已刪除。');
    await navigateTo(LIST_ROUTE);
  } catch (deleteError) {
    const statusCode = getApiErrorStatusCode(deleteError);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return;
    }

    deleteWorkOrderApiError.value = extractApiErrorEnvelope(deleteError);
    toast.error('刪除工單失敗。', {
      description: deleteWorkOrderApiError.value?.error.message ?? '請稍後再試。',
    });
  } finally {
    isDeletingWorkOrder.value = false;
  }
};

const submitWorkForm = async () => {
  if (!detail.value || isSubmittingWorkForm.value) {
    return;
  }

  clearWorkFeedback();

  const { fieldErrors, payload } = buildAdminWorkOrderStatusTransitionPayload(workForm);

  if (Object.keys(fieldErrors).length > 0 || !payload) {
    clientWorkFieldErrors.value = fieldErrors;
    toast.error('請先修正表單欄位。');
    return;
  }

  isSubmittingWorkForm.value = true;

  try {
    const response = await getRequestFetch()<{
      data: {
        lineNotification: AdminLineNotificationSummary;
        statusHistory: {
          changedAt: string | null;
          id: string | null;
          note: string | null;
          status: string | null;
        };
        workOrder: {
          cancelledAt: string | null;
          currentStatus: string | null;
          deliveredAt: string | null;
          id: string;
          paperOrderNo: string | null;
          readyForPickupAt: string | null;
          updatedAt: string | null;
        };
      };
    }>(`/api/admin/work-orders/${encodeURIComponent(routeWorkOrderId.value)}/status`, {
      body: payload,
      method: 'POST',
    });

    resetWorkForm();
    await refresh();

    if (fetchStatus.value !== 'success' || !detail.value) {
      toast.error('狀態已更新，但重新載入最新資料失敗。');
      return;
    }

    toast.success(`狀態已更新為「${getWorkOrderStatusLabel(payload.status)}」`);
    const lineFeedback = getAdminLineNotificationFeedback(response.data.lineNotification);
    if (lineFeedback?.tone === 'warning') toast.warning(lineFeedback.message);
    else if (lineFeedback?.tone === 'info') toast.info(lineFeedback.message);
    else if (lineFeedback?.tone === 'success') toast.success(lineFeedback.message);
  } catch (submitError) {
    const statusCode = getApiErrorStatusCode(submitError);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return;
    }

    submitWorkApiError.value = extractApiErrorEnvelope(submitError);
    toast.error('更新狀態失敗。', {
      description: submitWorkApiError.value?.error.message ?? '請稍後再試。',
    });
  } finally {
    isSubmittingWorkForm.value = false;
  }
};

const createPrintJobFromDetail = async (jobType: PrintJobType) => {
  if (!detail.value || !printSummary.value?.reprintAllowed || isSubmittingPrintAction.value) {
    return;
  }

  isSubmittingPrintAction.value = true;
  submittingPrintJobType.value = jobType;
  const jobTypeLabel = getPrintJobTypeLabel(jobType);
  const actionLabel = printSummary.value.latestJob ? '補印' : '列印任務';

  try {
    await getRequestFetch()('/api/admin/print-jobs', {
      body: {
        jobType,
        workOrderId: detail.value.id,
      },
      method: 'POST',
    });

    toast.success(`${jobTypeLabel}${actionLabel}已送出`);
    printActionDialogOpen.value = false;
    await refreshPrintSummary();
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    const apiEnvelope = extractApiErrorEnvelope(error);
    toast.error(`${jobTypeLabel}${actionLabel}失敗。`, {
      description: apiEnvelope?.error.message ?? '請稍後再試。',
    });
  } finally {
    isSubmittingPrintAction.value = false;
    submittingPrintJobType.value = null;
  }
};

onBeforeRouteUpdate((to, from) => {
  if (!hasUnsavedEditChanges.value) {
    return true;
  }

  const fromMode = normalizeAdminWorkOrderDetailRouteQuery(from.query).mode;
  const toMode = normalizeAdminWorkOrderDetailRouteQuery(to.query).mode;

  if (fromMode !== 'edit') {
    return true;
  }

  if (to.path !== from.path || toMode !== fromMode) {
    return confirmDiscardEditChanges();
  }

  return true;
});

onBeforeRouteLeave(() => {
  if (!hasUnsavedEditChanges.value) {
    return true;
  }

  return confirmDiscardEditChanges();
});

if (import.meta.client) {
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!hasUnsavedEditChanges.value) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  };

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Work order detail</Badge>
          <Badge variant="outline">{{ getAdminWorkOrderDetailModeLabel(detailMode) }}</Badge>
        </div>

        <div class="space-y-2">
          <h1 class="text-2xl font-semibold tracking-tight">{{ headerTitle }}</h1>
          <p class="max-w-3xl text-sm leading-6 text-muted-foreground">{{ headerSubtitle }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <WorkOrderStatusBadge :status="detail?.currentStatus ?? null" />
          <Badge variant="outline">
            {{
              detail ? formatBooleanLabel(detail.paymentReceived, '已收款', '未收款') : '付款狀態 —'
            }}
          </Badge>
          <span>收件日 {{ detail ? formatAdminDate(detail.intakeDate) : '—' }}</span>
          <span
            >預估完成日 {{ detail ? formatAdminDate(detail.estimatedCompletionDate) : '—' }}</span
          >
        </div>
      </div>

      <div class="flex flex-col gap-3 xl:items-end">
        <Button as-child type="button" variant="outline">
          <NuxtLink :to="LIST_ROUTE">返回工單列表</NuxtLink>
        </Button>

        <div class="inline-flex w-full flex-wrap gap-2 rounded-lg border bg-card p-1 xl:w-auto">
          <Button
            v-for="modeOption in ADMIN_WORK_ORDER_DETAIL_MODE_OPTIONS"
            :key="modeOption.value"
            size="sm"
            type="button"
            :variant="detailMode === modeOption.value ? 'default' : 'ghost'"
            @click="switchMode(modeOption.value)"
          >
            {{ modeOption.label }}
          </Button>
        </div>
      </div>
    </div>

    <ActionSuccessAlert
      v-if="shouldShowCreatedBanner"
      title="工單已建立"
      description="已轉到工單詳情頁；上方建單已成功，這裡可直接確認列印狀態或繼續後續操作。"
    />

    <div v-if="isInitialLoading" class="grid gap-4">
      <Card v-for="index in 4" :key="index">
        <CardHeader class="gap-3">
          <Skeleton class="h-6 w-40" />
          <Skeleton class="h-4 w-72" />
        </CardHeader>
        <CardContent class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton v-for="fieldIndex in 4" :key="fieldIndex" class="h-14 w-full" />
        </CardContent>
      </Card>
    </div>

    <Card v-else-if="isNotFound">
      <CardHeader>
        <CardTitle>work order not found</CardTitle>
        <CardDescription>找不到這張工單，請確認工單是否存在或重新回到列表查詢。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child type="button" variant="outline">
          <NuxtLink :to="LIST_ROUTE">返回工單列表</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <Card v-else-if="isInvalidRoute">
      <CardHeader>
        <CardTitle>invalid work order id / route</CardTitle>
        <CardDescription>工單 id 或路由格式無效，請從工單列表重新進入。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child type="button" variant="outline">
          <NuxtLink :to="LIST_ROUTE">返回工單列表</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <Card v-else-if="hasGeneralError">
      <CardHeader>
        <CardTitle>工單詳情載入失敗</CardTitle>
        <CardDescription>
          {{ apiError?.error.message ?? '目前無法取得工單資料，請稍後再試。' }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-3">
        <Button type="button" @click="refresh">重新載入</Button>
        <Button as-child type="button" variant="outline">
          <NuxtLink :to="LIST_ROUTE">返回工單列表</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <template v-else-if="detail">
      <Card v-if="detailMode === 'edit'">
        <CardHeader class="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>管理修正</CardTitle>
            <CardDescription>
              只更新既有 PATCH 白名單欄位。狀態、顧客與板子快照維持只讀。
            </CardDescription>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              :disabled="!canDeleteWorkOrder"
              @click="deleteWorkOrder"
            >
              <Spinner v-if="isDeletingWorkOrder" data-icon="inline-start" />
              <Trash2Icon v-else data-icon="inline-start" />
              刪除工單
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="!isEditDirty || isSubmittingEditForm || isDeletingWorkOrder"
              @click="resetEditForm"
            >
              Reset
            </Button>
            <Button type="button" :disabled="!canSubmitEditForm" @click="submitEditForm">
              <Spinner v-if="isSubmittingEditForm" data-icon="inline-start" />
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <Alert v-if="editFormAlertMessages.length > 0" variant="destructive">
            <AlertTitle>更新資料時發生錯誤</AlertTitle>
            <AlertDescription class="space-y-2">
              <ul class="ml-4 list-disc space-y-1">
                <li v-for="message in editFormAlertMessages" :key="message">{{ message }}</li>
              </ul>
              <p v-if="submitEditApiError?.error.requestId" class="text-xs text-destructive/80">
                requestId: {{ submitEditApiError.error.requestId }}
              </p>
            </AlertDescription>
          </Alert>

          <p class="text-sm text-muted-foreground">
            送出後會 refresh 最新工單資料，再切回檢視模式。
          </p>
        </CardContent>
      </Card>

      <Card v-if="detailMode === 'work'">
        <CardHeader class="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-2">
            <CardTitle>現場狀態操作</CardTitle>
            <CardDescription>
              直接追加一筆狀態歷史並同步更新目前狀態。可選同一狀態補記備註。
            </CardDescription>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge
              v-if="currentStatusMeta"
              :class="currentStatusMeta.badgeClass"
              :variant="currentStatusMeta.variant"
            >
              目前狀態：{{ currentStatusMeta.label }}
            </Badge>
            <Badge variant="outline">板型：{{ getBoardTypeLabel(detail.board.boardType) }}</Badge>
            <Badge variant="outline">
              長度分類：{{ getBoardLengthClassLabel(detail.board.boardLengthClass) }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="space-y-6">
          <Alert v-if="workFormAlertMessages.length > 0" variant="destructive">
            <AlertTitle>更新狀態時發生錯誤</AlertTitle>
            <AlertDescription class="space-y-2">
              <ul class="ml-4 list-disc space-y-1">
                <li v-for="message in workFormAlertMessages" :key="message">{{ message }}</li>
              </ul>
              <p v-if="submitWorkApiError?.error.requestId" class="text-xs text-destructive/80">
                requestId: {{ submitWorkApiError.error.requestId }}
              </p>
            </AlertDescription>
          </Alert>

          <div class="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <FieldGroup>
              <Field :data-invalid="workFieldErrors.status?.length ? 'true' : undefined">
                <FieldLabel for="work-status">新狀態</FieldLabel>
                <Select :model-value="workForm.status" @update:model-value="handleWorkStatusChange">
                  <SelectTrigger id="work-status" class="w-full">
                    <SelectValue placeholder="選擇要追加的狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="statusOption in ADMIN_WORK_ORDER_STATUS_OPTIONS"
                      :key="statusOption.value"
                      :disabled="
                        isWorkOrderStatusBlockedForBoardType(
                          detail.board.boardType,
                          statusOption.value,
                        )
                      "
                      :value="statusOption.value"
                    >
                      {{ statusOption.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  可選和目前相同的狀態，用於補記另一筆事件備註。雪板不可進除濕中。
                </FieldDescription>
                <FieldError :errors="workFieldErrors.status" />
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field :data-invalid="workFieldErrors.note?.length ? 'true' : undefined">
                <FieldLabel for="work-note">狀態備註</FieldLabel>
                <Textarea
                  id="work-note"
                  v-model="workForm.note"
                  :aria-invalid="Boolean(workFieldErrors.note?.length)"
                  @input="handleWorkFieldInput"
                />
                <FieldDescription
                  >空白會以 `null` 送出，但 `note` 欄位仍會包含在 request 中。</FieldDescription
                >
                <FieldError :errors="workFieldErrors.note" />
              </Field>

              <Field :data-invalid="workFieldErrors.internalNote?.length ? 'true' : undefined">
                <FieldLabel for="work-internal-note">內部備註（可選）</FieldLabel>
                <Textarea
                  id="work-internal-note"
                  v-model="workForm.internalNote"
                  :aria-invalid="Boolean(workFieldErrors.internalNote?.length)"
                  @input="handleWorkFieldInput"
                />
                <FieldDescription>
                  留空代表不變更既有內部備註；若要清空，請改用管理修正模式。
                </FieldDescription>
                <FieldError :errors="workFieldErrors.internalNote" />
              </Field>
            </FieldGroup>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              :disabled="isSubmittingWorkForm"
              @click="resetWorkForm"
            >
              清除
            </Button>
            <Button type="button" :disabled="!canSubmitWorkForm" @click="submitWorkForm">
              <Spinner v-if="isSubmittingWorkForm" data-icon="inline-start" />
              更新狀態
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>工單摘要</CardTitle>
            <CardDescription>工單本身的進件、預估完成與付款資訊。</CardDescription>
          </CardHeader>
          <CardContent v-if="detailMode === 'edit'" class="space-y-6">
            <div class="grid gap-6 md:grid-cols-2">
              <FieldGroup>
                <Field
                  :data-invalid="
                    editFieldErrors.estimatedCompletionDate?.length ? 'true' : undefined
                  "
                >
                  <FieldLabel for="edit-estimated-completion-date">預估完成日</FieldLabel>
                  <Popover v-model:open="editEstimatedDatePopoverOpen">
                    <PopoverTrigger as-child>
                      <Button
                        id="edit-estimated-completion-date"
                        type="button"
                        variant="outline"
                        class="w-full justify-between text-left font-normal"
                        :aria-invalid="Boolean(editFieldErrors.estimatedCompletionDate?.length)"
                      >
                        <span>
                          {{
                            editForm.estimatedCompletionDate
                              ? formatAdminDate(editForm.estimatedCompletionDate)
                              : '選擇日期'
                          }}
                        </span>
                        <CalendarIcon class="text-muted-foreground size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-auto p-3">
                      <Calendar v-model="editEstimatedCalendarValue" initial-focus />
                    </PopoverContent>
                  </Popover>
                  <div class="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      :disabled="!editForm.estimatedCompletionDate"
                      @click="
                        editForm.estimatedCompletionDate = '';
                        editEstimatedDatePopoverOpen = false;
                        handleEditFieldInput();
                      "
                    >
                      清空日期
                    </Button>
                  </div>
                  <FieldDescription>可留空；留空送出時會更新為 null。</FieldDescription>
                  <FieldError :errors="editFieldErrors.estimatedCompletionDate" />
                </Field>

                <Field :data-invalid="editFieldErrors.paymentReceived?.length ? 'true' : undefined">
                  <div class="flex items-start gap-3">
                    <Checkbox
                      id="edit-payment-received"
                      :model-value="editForm.paymentReceived"
                      class="mt-1"
                      @update:model-value="handlePaymentReceivedChange"
                    />
                    <FieldContent class="gap-2">
                      <FieldLabel for="edit-payment-received">已收款</FieldLabel>
                      <FieldDescription
                        >切換後由 server 維護
                        `paymentReceivedAt`，前端不本地推算。</FieldDescription
                      >
                      <FieldError :errors="editFieldErrors.paymentReceived" />
                    </FieldContent>
                  </div>
                </Field>
              </FieldGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel>收件日</FieldLabel>
                  <p class="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                    {{ formatAdminDate(detail.intakeDate) }}
                  </p>
                </Field>

                <Field>
                  <FieldLabel>收款時間</FieldLabel>
                  <p class="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                    {{ formatAdminDateTime(detail.paymentReceivedAt) }}
                  </p>
                </Field>
              </FieldGroup>
            </div>
          </CardContent>

          <CardContent v-else class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div v-for="field in summaryFields" :key="field.label" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                <p class="text-sm font-medium">{{ field.value }}</p>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div v-for="field in detailNoteFields" :key="field.label" class="space-y-2">
                <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                <p class="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6">
                  {{ field.value }}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div class="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>列印狀態</CardTitle>
              <CardDescription>顯示最新一筆列印任務，完整操作仍以列印中心為主。</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div v-if="isPrintSummaryLoading" class="space-y-3">
                <Skeleton class="h-5 w-28" />
                <Skeleton class="h-16 w-full" />
              </div>

              <template v-else>
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1">
                    <p class="text-sm text-muted-foreground">最新狀態</p>
                    <PrintJobStatusBadge
                      v-if="printSummary?.latestJob"
                      :status="printSummary.latestJob.status"
                    />
                    <p v-else class="text-sm font-medium">尚未建立列印任務</p>
                  </div>

                  <Button as-child type="button" variant="outline">
                    <NuxtLink :to="printCenterPath">前往列印中心</NuxtLink>
                  </Button>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="space-y-1">
                    <p class="text-sm text-muted-foreground">最近更新</p>
                    <p class="text-sm font-medium">
                      {{
                        printSummary?.latestJob
                          ? formatAdminDateTime(printSummary.latestJob.updatedAt)
                          : '—'
                      }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm text-muted-foreground">列印完成時間</p>
                    <p class="text-sm font-medium">
                      {{
                        printSummary?.latestJob
                          ? formatAdminDateTime(printSummary.latestJob.printedAt)
                          : '—'
                      }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm text-muted-foreground">失敗 / 補印狀態</p>
                    <p class="text-sm font-medium">
                      {{
                        printSummary?.hasFailedJob
                          ? '曾有失敗任務'
                          : printSummary?.hasPendingJob
                            ? '目前有待處理任務'
                            : '—'
                      }}
                    </p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm text-muted-foreground">最新錯誤</p>
                    <p class="text-sm font-medium">
                      {{ printSummary?.latestJob?.lastError?.trim() || '—' }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="printSummary?.reprintAllowed"
                  class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-3"
                >
                  <p class="text-sm text-muted-foreground">
                    {{
                      printSummary?.latestJob
                        ? '需要重送時，會建立新的 print job，不覆蓋舊紀錄。'
                        : '目前還沒有列印任務；可手動建立第一筆列印任務。'
                    }}
                  </p>
                  <Button
                    type="button"
                    :disabled="isSubmittingPrintAction"
                    @click="printActionDialogOpen = true"
                  >
                    <Spinner v-if="isSubmittingPrintAction" data-icon="inline-start" />
                    {{ printActionLabel }}
                  </Button>
                </div>

                <Dialog
                  :open="printActionDialogOpen"
                  @update:open="(open) => (printActionDialogOpen = open)"
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{{ printActionLabel }}</DialogTitle>
                      <DialogDescription>
                        選擇要建立的列印任務。每次補印都會新增一筆 print job，不會覆蓋舊紀錄。
                      </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <Button
                        v-for="option in PRINT_JOB_CREATE_OPTIONS"
                        :key="option.jobType"
                        type="button"
                        variant="outline"
                        class="h-auto justify-start whitespace-normal p-4 text-left"
                        :disabled="isSubmittingPrintAction"
                        @click="createPrintJobFromDetail(option.jobType)"
                      >
                        <span class="flex flex-col gap-1">
                          <span class="flex items-center gap-2 font-medium">
                            <Spinner
                              v-if="submittingPrintJobType === option.jobType"
                              data-icon="inline-start"
                            />
                            {{ getPrintJobTypeLabel(option.jobType) }}
                          </span>
                          <span class="text-sm font-normal text-muted-foreground">
                            {{ option.description }}
                          </span>
                        </span>
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="isSubmittingPrintAction"
                        @click="printActionDialogOpen = false"
                      >
                        取消
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </template>
            </CardContent>
          </Card>

          <WorkOrderLineStatusCard :work-order-id="detail.id" />

          <Card>
            <CardHeader>
              <CardTitle>顧客資訊</CardTitle>
              <CardDescription>目前綁定在這張工單上的顧客基本資料。</CardDescription>
            </CardHeader>
            <CardContent class="grid gap-4 sm:grid-cols-2">
              <div v-for="field in customerFields" :key="field.label" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                <p class="text-sm font-medium">{{ field.value }}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        v-if="detailMode === 'edit'"
        class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle>維修與備註</CardTitle>
            <CardDescription>可編輯 damage / public / internal 三組文字欄位。</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field :data-invalid="editFieldErrors.damageDescription?.length ? 'true' : undefined">
                <FieldLabel for="edit-damage-description">損傷描述</FieldLabel>
                <Textarea
                  id="edit-damage-description"
                  v-model="editForm.damageDescription"
                  :aria-invalid="Boolean(editFieldErrors.damageDescription?.length)"
                  @input="handleEditFieldInput"
                />
                <FieldError :errors="editFieldErrors.damageDescription" />
              </Field>

              <Field :data-invalid="editFieldErrors.repairCount?.length ? 'true' : undefined">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1">
                    <FieldLabel>受損位置標記</FieldLabel>
                    <FieldDescription>
                      已標記 {{ editForm.repairMarks.length }} 處，可開啟 Konva 面板調整。
                    </FieldDescription>
                  </div>
                  <Button type="button" variant="outline" @click="openRepairMarksDialog">
                    <MapPinnedIcon class="size-4" />
                    受損位置
                  </Button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Badge variant="outline"
                    >來源：{{ editForm.repairCountSource === 'auto' ? '自動' : '手動' }}</Badge
                  >
                  <Badge variant="outline">維修處數：{{ editForm.repairCount || '—' }}</Badge>
                </div>
                <FieldError :errors="editFieldErrors.repairCount" />
              </Field>

              <Alert v-if="editRepairCountMismatch">
                <AlertTitle>維修處數已手動調整</AlertTitle>
                <AlertDescription>
                  已標記 {{ editForm.repairMarks.length }} 處，但維修處數手動設定為
                  {{ editForm.repairCount }} 處。
                </AlertDescription>
              </Alert>

              <Field :data-invalid="editFieldErrors.publicNote?.length ? 'true' : undefined">
                <FieldLabel for="edit-public-note">公開備註</FieldLabel>
                <Textarea
                  id="edit-public-note"
                  v-model="editForm.publicNote"
                  :aria-invalid="Boolean(editFieldErrors.publicNote?.length)"
                  @input="handleEditFieldInput"
                />
                <FieldDescription>空字串或全空白送出時會視為 null。</FieldDescription>
                <FieldError :errors="editFieldErrors.publicNote" />
              </Field>

              <Field :data-invalid="editFieldErrors.internalNote?.length ? 'true' : undefined">
                <FieldLabel for="edit-internal-note">內部備註</FieldLabel>
                <Textarea
                  id="edit-internal-note"
                  v-model="editForm.internalNote"
                  :aria-invalid="Boolean(editFieldErrors.internalNote?.length)"
                  @input="handleEditFieldInput"
                />
                <FieldDescription>只存在於管理端，不會回到顧客查詢。</FieldDescription>
                <FieldError :errors="editFieldErrors.internalNote" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>取件設定</CardTitle>
            <CardDescription>第一版只允許編輯 pickup note 與提醒門檻。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="field in pickupFields" :key="field.label" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                <p class="text-sm font-medium">{{ field.value }}</p>
              </div>
            </div>

            <FieldGroup>
              <Field :data-invalid="editFieldErrors.pickupNote?.length ? 'true' : undefined">
                <FieldLabel for="edit-pickup-note">取件備註</FieldLabel>
                <Textarea
                  id="edit-pickup-note"
                  v-model="editForm.pickupNote"
                  :aria-invalid="Boolean(editFieldErrors.pickupNote?.length)"
                  @input="handleEditFieldInput"
                />
                <FieldError :errors="editFieldErrors.pickupNote" />
              </Field>

              <Field
                :data-invalid="
                  editFieldErrors.storageFeeWarningAfterDays?.length ? 'true' : undefined
                "
              >
                <FieldLabel for="edit-storage-fee-warning-days">提醒門檻（天）</FieldLabel>
                <Input
                  id="edit-storage-fee-warning-days"
                  v-model="editForm.storageFeeWarningAfterDays"
                  :aria-invalid="Boolean(editFieldErrors.storageFeeWarningAfterDays?.length)"
                  autocomplete="off"
                  inputmode="numeric"
                  placeholder="例如 14"
                  @input="handleEditFieldInput"
                />
                <FieldDescription>表單 state 先保留字串，送出時才轉正整數。</FieldDescription>
                <FieldError :errors="editFieldErrors.storageFeeWarningAfterDays" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div v-else class="space-y-4">
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>板子資訊</CardTitle>
              <CardDescription>工單建立時保留的板子快照欄位。</CardDescription>
            </CardHeader>
            <CardContent class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div v-for="field in boardFields" :key="field.label" class="space-y-1">
                <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                <WorkOrderBoardColorSwatch
                  v-if="field.isBoardColor"
                  :color="detail.board.color"
                  empty-label="—"
                />
                <p v-else class="text-sm font-medium">{{ field.value }}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>取件資訊</CardTitle>
              <CardDescription>第一版 pickup 資料來自 `work_orders` inline 欄位。</CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <div class="grid gap-4 sm:grid-cols-2">
                <div v-for="field in pickupFields" :key="field.label" class="space-y-1">
                  <p class="text-sm text-muted-foreground">{{ field.label }}</p>
                  <p class="text-sm font-medium">{{ field.value }}</p>
                </div>
              </div>

              <div class="space-y-2">
                <p class="text-sm text-muted-foreground">取件備註</p>
                <p class="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6">
                  {{ formatNullableText(detail.pickupInfo.pickupNote) }}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>受損位置</CardTitle>
            <CardDescription>只讀顯示 repair marks 與維修處數摘要。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Badge variant="outline">正面 {{ detailRepairMarksSummary.frontCount }} 處</Badge>
              <Badge variant="outline">背面 {{ detailRepairMarksSummary.backCount }} 處</Badge>
              <Badge variant="outline">維修處數 {{ detail.repairCount ?? '—' }}</Badge>
            </div>

            <RepairMarksSurfaceGallery
              :board-type="detail.board.boardType || 'SURFBOARD'"
              :canvas-height="760"
              :canvas-width="500"
              dual-surface-min-height-class="min-h-[24rem] xl:min-h-[34rem]"
              :marks="detail.repairMarks"
              single-surface-canvas-wrapper-class="mx-auto h-auto w-full max-w-[26rem] aspect-[500/760]"
              single-surface-min-height-class="min-h-0"
              surface-gap-class="gap-4"
            />
          </CardContent>
        </Card>
      </div>

      <Card v-if="detailMode === 'edit'">
        <CardHeader>
          <CardTitle>板子資訊</CardTitle>
          <CardDescription>工單建立時保留的板子快照欄位。</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="field in boardFields" :key="field.label" class="space-y-1">
            <p class="text-sm text-muted-foreground">{{ field.label }}</p>
            <WorkOrderBoardColorSwatch
              v-if="field.isBoardColor"
              :color="detail.board.color"
              empty-label="—"
            />
            <p v-else class="text-sm font-medium">{{ field.value }}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>報價資訊</CardTitle>
            <CardDescription>目前工單上的初始與追加報價項目。</CardDescription>
          </div>

          <div class="space-y-1 text-left md:text-right">
            <p class="text-sm text-muted-foreground">報價總額</p>
            <p class="text-lg font-semibold">{{ formatCurrency(detail.quoteTotalAmount) }}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="detail.quoteItems.length > 0" class="space-y-3">
            <div
              v-for="quoteItem in detail.quoteItems"
              :key="quoteItem.id ?? `${quoteItem.itemType}-${quoteItem.createdAt}`"
              class="rounded-lg border bg-card p-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ getQuoteItemTypeLabel(quoteItem.itemType) }}</Badge>
                    <span class="font-medium">{{ formatNullableText(quoteItem.description) }}</span>
                  </div>
                  <p class="text-sm text-muted-foreground">
                    建立時間 {{ formatAdminDateTime(quoteItem.createdAt) }}
                  </p>
                </div>

                <p class="text-base font-semibold">{{ formatCurrency(quoteItem.amount) }}</p>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-muted-foreground">尚無報價項目。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>狀態歷史</CardTitle>
          <CardDescription
            >狀態歷史採 append-only；目前僅顯示，不在 F5B 內提供編輯。</CardDescription
          >
        </CardHeader>
        <CardContent>
          <div v-if="detail.statusHistory.length > 0" class="space-y-3">
            <div
              v-for="statusEntry in detail.statusHistory"
              :key="statusEntry.id ?? `${statusEntry.status}-${statusEntry.changedAt}`"
              class="rounded-lg border bg-card p-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <WorkOrderStatusBadge :status="statusEntry.status" />
                    <span class="text-sm text-muted-foreground">
                      {{ formatAdminDateTime(statusEntry.changedAt) }}
                    </span>
                  </div>
                  <p class="text-sm leading-6">{{ formatNullableText(statusEntry.note) }}</p>
                </div>

                <p class="text-sm text-muted-foreground">
                  {{ getWorkOrderStatusLabel(statusEntry.status) }}
                </p>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-muted-foreground">尚無狀態歷史。</p>
        </CardContent>
      </Card>

      <RepairMarksEditorDialog
        v-if="detailMode === 'edit' && detail?.board.boardType"
        v-model:open="repairMarksDialogOpen"
        :board-type="detail.board.boardType"
        :repair-count="editForm.repairCount"
        :repair-count-source="editForm.repairCountSource"
        :repair-marks="editForm.repairMarks"
        @save="handleRepairMarksSave"
      />
    </template>
  </div>
</template>
