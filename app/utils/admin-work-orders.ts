import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import { z } from 'zod';
import type { Database } from '../../types/database.types';
import type { RepairCountSource, RepairMark } from './repair-marks';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type BoardType = Database['public']['Enums']['board_type'];
type BoardLengthClass = Database['public']['Enums']['board_length_class'];
type QuoteItemType = Database['public']['Enums']['quote_item_type'];

export interface WorkOrderListFlags {
  overdueEstimatedCompletion: boolean;
  pickupOverdue: boolean;
  staleReceived: boolean;
}

export interface AdminWorkOrderListItem {
  board: {
    color: string | null;
    boardLengthClass: BoardLengthClass | null;
    boardType: BoardType | null;
    sizeLabel: string | null;
  };
  currentStatus: WorkOrderStatus | null;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  };
  estimatedCompletionDate: string | null;
  flags: WorkOrderListFlags;
  id: string | null;
  intakeDate: string | null;
  lastUpdatedAt: string | null;
  paperOrderNo: string | null;
  paymentReceived: boolean | null;
  paymentReceivedAt: string | null;
  quoteTotalAmount: number | null;
  readyForPickupAt: string | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminWorkOrderListResponse {
  data: AdminWorkOrderListItem[];
  pageInfo: PageInfo;
}

export interface AdminWorkOrderQuoteItem {
  amount: number | null;
  createdAt: string | null;
  description: string | null;
  id: string | null;
  itemType: QuoteItemType | null;
}

export interface AdminWorkOrderStatusHistoryItem {
  changedAt: string | null;
  id: string | null;
  note: string | null;
  status: WorkOrderStatus | null;
}

export interface AdminWorkOrderPickupInfo {
  daysWaitingForPickup: number | null;
  isPickupOverdue: boolean;
  notifiedAt: string | null;
  pickedUpAt: string | null;
  pickupNote: string | null;
  storageFeeWarningAfterDays: number | null;
}

export interface AdminWorkOrderDetailItem {
  board: {
    boardLengthClass: BoardLengthClass | null;
    boardType: BoardType | null;
    brand: string | null;
    color: string | null;
    model: string | null;
    serialLabel: string | null;
    sizeLabel: string | null;
  };
  currentStatus: WorkOrderStatus | null;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  };
  damageDescription: string | null;
  estimatedCompletionDate: string | null;
  id: string;
  intakeDate: string | null;
  internalNote: string | null;
  paperOrderNo: string | null;
  paymentReceived: boolean | null;
  paymentReceivedAt: string | null;
  pickupInfo: AdminWorkOrderPickupInfo;
  publicNote: string | null;
  repairCount: number | null;
  repairCountSource: RepairCountSource;
  repairMarkCount: number;
  repairMarks: RepairMark[];
  quoteItems: AdminWorkOrderQuoteItem[];
  quoteTotalAmount: number | null;
  statusHistory: AdminWorkOrderStatusHistoryItem[];
}

export interface AdminWorkOrderDetailResponse {
  data: AdminWorkOrderDetailItem;
}

export type AdminWorkOrderScanAction =
  | 'add_note'
  | 'mark_delivered'
  | 'mark_paid'
  | 'open_detail'
  | 'update_status';

export interface AdminWorkOrderScanHistoryItem {
  changedAt: string;
  fromStatus: WorkOrderStatus | null;
  id: string;
  note: string | null;
  toStatus: WorkOrderStatus;
}

export interface AdminWorkOrderScanLookupData {
  availableActions: AdminWorkOrderScanAction[];
  availableStatusTransitions: WorkOrderStatus[];
  board: {
    boardLengthClass: BoardLengthClass | null;
    brand: string | null;
    color: string | null;
    damageDescription: string | null;
    serialLabel: string | null;
    sizeLabel: string | null;
    type: BoardType | null;
  };
  customer: {
    name: string | null;
    phone: string | null;
  };
  notes: {
    internalNote: string | null;
    pickupNote: string | null;
    publicNote: string | null;
  };
  pricing: {
    additionalAmount: number | null;
    finalAmount: number | null;
    initialQuoteAmount: number | null;
  };
  recentHistory: AdminWorkOrderScanHistoryItem[];
  summary: {
    daysInShop: number | null;
    estimatedCompletedAt: string | null;
    id: string;
    isOverdue: boolean;
    lastUpdatedAt: string;
    paperOrderNo: string;
    paymentReceived: boolean;
    receivedAt: string | null;
    status: WorkOrderStatus;
  };
}

export interface AdminWorkOrderScanLookupResponse {
  data: AdminWorkOrderScanLookupData;
}

export interface AdminWorkOrderScanQuickNoteResponse {
  data: {
    id: string;
    internalNote: string | null;
    updatedAt: string;
  };
}

export interface AdminWorkOrderResolveItem {
  board: {
    color: string | null;
    boardLengthClass: BoardLengthClass | null;
    boardType: BoardType | null;
    sizeLabel: string | null;
  };
  currentStatus: WorkOrderStatus;
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
  };
  estimatedCompletionDate: string | null;
  flags: WorkOrderListFlags;
  id: string;
  lastUpdatedAt: string | null;
  paperOrderNo: string;
}

export interface AdminWorkOrderResolveResponse {
  data: AdminWorkOrderResolveItem;
}

export type AdminWorkOrderBulkStatusSkipReason = 'INVALID_STATUS_TRANSITION' | 'NOT_FOUND';

export interface AdminWorkOrderBulkStatusUpdatedItem {
  currentStatus: WorkOrderStatus;
  paperOrderNo: string;
  statusHistoryId: string;
  workOrderId: string;
}

export interface AdminWorkOrderBulkStatusSkippedItem {
  paperOrderNo: string;
  reason: AdminWorkOrderBulkStatusSkipReason;
}

export interface AdminWorkOrderBulkStatusResponse {
  data: {
    dedupedCount: number;
    requestedCount: number;
    skipped: AdminWorkOrderBulkStatusSkippedItem[];
    skippedCount: number;
    updated: AdminWorkOrderBulkStatusUpdatedItem[];
    updatedCount: number;
  };
}

export interface AdminWorkOrderEditFormState {
  damageDescription: string;
  estimatedCompletionDate: string;
  internalNote: string;
  paymentReceived: boolean;
  pickupNote: string;
  publicNote: string;
  repairCount: string;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
  storageFeeWarningAfterDays: string;
}

export interface AdminWorkOrderWorkFormState {
  internalNote: string;
  note: string;
  status: WorkOrderStatus | '';
}

export interface AdminWorkOrderEditNormalizedSnapshot {
  damageDescription: string | null;
  estimatedCompletionDate: string | null;
  internalNote: string | null;
  paymentReceived: boolean;
  pickupNote: string | null;
  publicNote: string | null;
  repairCount: string;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
  storageFeeWarningAfterDays: string;
}

export interface AdminWorkOrderListQueryState {
  customerPhone?: string;
  overdueEstimatedCompletion: boolean;
  page: number;
  pageSize: number;
  pickupOverdue: boolean;
  q?: string;
  sort: AdminWorkOrderListSortValue;
  staleReceived: boolean;
  status?: WorkOrderStatus;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    fieldErrors?: Record<string, string[]>;
    message: string;
    requestId?: string;
  };
}

export const DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE = 1;
export const DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_WORK_ORDER_LIST_SORT = 'created_at:desc';
export const DEFAULT_ADMIN_WORK_ORDER_DETAIL_MODE = 'view';
export const ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const ADMIN_WORK_ORDER_EDITABLE_FIELDS = [
  'estimatedCompletionDate',
  'damageDescription',
  'paymentReceived',
  'repairCount',
  'repairCountSource',
  'repairMarks',
  'publicNote',
  'internalNote',
  'pickupNote',
  'storageFeeWarningAfterDays',
] as const;

export const ADMIN_WORK_ORDER_LIST_SORT_OPTIONS = [
  { label: '最新建立', value: 'created_at:desc' },
  { label: '最早建立', value: 'created_at:asc' },
  { label: '最近更新', value: 'updated_at:desc' },
  { label: '最早更新', value: 'updated_at:asc' },
  { label: '最新收件日', value: 'intake_date:desc' },
  { label: '最早收件日', value: 'intake_date:asc' },
  { label: '預估完成日（近到遠）', value: 'estimated_completion_date:asc' },
  { label: '預估完成日（遠到近）', value: 'estimated_completion_date:desc' },
  { label: '狀態（A-Z）', value: 'current_status:asc' },
  { label: '狀態（Z-A）', value: 'current_status:desc' },
  { label: '工單號（小到大）', value: 'paper_order_no:asc' },
  { label: '工單號（大到小）', value: 'paper_order_no:desc' },
  { label: '報價金額（低到高）', value: 'quote_total_amount:asc' },
  { label: '報價金額（高到低）', value: 'quote_total_amount:desc' },
] as const;

export const ADMIN_WORK_ORDER_STATUS_OPTIONS = [
  { label: '已收件', value: 'RECEIVED' },
  { label: '除濕中', value: 'DRYING' },
  { label: '維修中', value: 'REPAIRING' },
  { label: '已完工待取件', value: 'READY_FOR_PICKUP' },
  { label: '已交件', value: 'DELIVERED' },
  { label: '已取消', value: 'CANCELLED' },
] as const satisfies ReadonlyArray<{ label: string; value: WorkOrderStatus }>;

export const ADMIN_WORK_ORDER_DETAIL_MODE_OPTIONS = [
  { label: '檢視', value: 'view' },
  { label: '現場作業', value: 'work' },
  { label: '管理修正', value: 'edit' },
] as const;

export type AdminWorkOrderListSortValue =
  (typeof ADMIN_WORK_ORDER_LIST_SORT_OPTIONS)[number]['value'];
export type AdminWorkOrderDetailMode =
  (typeof ADMIN_WORK_ORDER_DETAIL_MODE_OPTIONS)[number]['value'];
export type AdminWorkOrderEditableField = (typeof ADMIN_WORK_ORDER_EDITABLE_FIELDS)[number];
export type AdminWorkOrderPatchPayload = Partial<{
  damageDescription: string | null;
  estimatedCompletionDate: string | null;
  internalNote: string | null;
  paymentReceived: boolean;
  pickupNote: string | null;
  publicNote: string | null;
  repairCount: number | null;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
  storageFeeWarningAfterDays: number;
}>;

export interface AdminWorkOrderStatusTransitionPayload {
  internalNote?: string;
  note: string | null;
  status: WorkOrderStatus;
}

export type WorkOrderFlagKey = keyof WorkOrderListFlags;
export interface BoardColorSwatchMeta {
  label: string;
  swatchClass: string;
}

const sortValueSchema = z.enum(
  ADMIN_WORK_ORDER_LIST_SORT_OPTIONS.map((option) => option.value) as [
    AdminWorkOrderListSortValue,
    ...AdminWorkOrderListSortValue[],
  ],
);

const statusValueSchema = z.enum(
  ADMIN_WORK_ORDER_STATUS_OPTIONS.map((option) => option.value) as [
    WorkOrderStatus,
    ...WorkOrderStatus[],
  ],
);

const detailModeValueSchema = z.enum(
  ADMIN_WORK_ORDER_DETAIL_MODE_OPTIONS.map((option) => option.value) as [
    AdminWorkOrderDetailMode,
    ...AdminWorkOrderDetailMode[],
  ],
);

const editPayloadSchema = z.object({
  damageDescription: z.string().nullable().optional(),
  estimatedCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  internalNote: z.string().nullable().optional(),
  paymentReceived: z.boolean().optional(),
  pickupNote: z.string().nullable().optional(),
  publicNote: z.string().nullable().optional(),
  storageFeeWarningAfterDays: z.number().int().min(1).max(32767).optional(),
});

const statusTransitionPayloadSchema = z.object({
  internalNote: z.string().optional(),
  note: z.string().nullable(),
  status: statusValueSchema,
});

const pageSizeSchema = z.enum(
  ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS.map(String) as [
    `${(typeof ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS)[number]}`,
    ...Array<`${(typeof ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS)[number]}`>,
  ],
);

const WORK_ORDER_STATUS_META: Record<
  WorkOrderStatus,
  {
    badgeClass: string;
    label: string;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
  }
> = {
  CANCELLED: {
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    label: '已取消',
    variant: 'outline',
  },
  DELIVERED: {
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: '已交件',
    variant: 'outline',
  },
  DRYING: {
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    label: '除濕中',
    variant: 'outline',
  },
  READY_FOR_PICKUP: {
    badgeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    label: '已完工待取件',
    variant: 'outline',
  },
  RECEIVED: {
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    label: '已收件',
    variant: 'secondary',
  },
  REPAIRING: {
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    label: '維修中',
    variant: 'outline',
  },
};

const WORK_ORDER_FLAG_META: Record<
  WorkOrderFlagKey,
  { badgeClass: string; label: string; variant: 'destructive' | 'outline' }
> = {
  overdueEstimatedCompletion: {
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    label: '超過預估日',
    variant: 'outline',
  },
  pickupOverdue: {
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    label: '待取件超時',
    variant: 'destructive',
  },
  staleReceived: {
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    label: '未開工過久',
    variant: 'outline',
  },
};

const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  SNOWBOARD: '雪板',
  SUP: 'SUP',
  SURFBOARD: '衝浪板',
};

const BOARD_LENGTH_CLASS_LABELS: Record<BoardLengthClass, string> = {
  LONGBOARD: '長板',
  MID_LENGTH: '中尺寸',
  SHORTBOARD: '短板',
};

const BOARD_COLOR_SWATCH_META: Record<string, BoardColorSwatchMeta> = {
  BLACK: {
    label: '黑色',
    swatchClass: 'border-slate-950 bg-slate-950',
  },
  BLUE: {
    label: '藍色',
    swatchClass: 'border-blue-500 bg-blue-500',
  },
  GRAY: {
    label: '灰色',
    swatchClass: 'border-slate-400 bg-slate-400',
  },
  GREEN: {
    label: '綠色',
    swatchClass: 'border-emerald-500 bg-emerald-500',
  },
  RED: {
    label: '紅色',
    swatchClass: 'border-red-500 bg-red-500',
  },
  WHITE: {
    label: '白色',
    swatchClass: 'border-slate-300 bg-white',
  },
  YELLOW: {
    label: '黃色',
    swatchClass: 'border-amber-400 bg-amber-300',
  },
};

const QUOTE_ITEM_TYPE_LABELS: Record<QuoteItemType, string> = {
  ADDITIONAL: '追加報價',
  ADJUSTMENT: '調整項目',
  INITIAL: '初始報價',
};

const DETAIL_MODE_LABELS: Record<AdminWorkOrderDetailMode, string> = {
  edit: '管理修正',
  view: '檢視',
  work: '現場作業',
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
});

type QueryValue =
  | LocationQuery[string]
  | LocationQueryRaw[string]
  | Array<string | number | null | undefined>
  | string
  | number
  | null
  | undefined;

const getSingleQueryValue = (value: QueryValue): string | undefined => {
  if (Array.isArray(value)) {
    return getSingleQueryValue(value[0]);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return typeof value === 'string' ? value : undefined;
};

const trimQueryValue = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
};

const normalizeNullableText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
};

const normalizeNullableDate = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
};

const normalizeStorageFeeWarningInput = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value).trim();

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  return parsedValue > 0 ? parsedValue : undefined;
};

const parseBooleanQueryValue = (value: string | undefined): boolean | undefined | 'invalid' => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return 'invalid';
};

const toComparableQuery = (query: LocationQuery | LocationQueryRaw) =>
  Object.fromEntries(
    Object.entries(query)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );

export const createEmptyAdminWorkOrderListResponse = (
  page = DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE,
  pageSize = DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE_SIZE,
): AdminWorkOrderListResponse => ({
  data: [],
  pageInfo: {
    hasNextPage: false,
    hasPreviousPage: page > 1,
    page,
    pageSize,
    total: 0,
    totalPages: 0,
  },
});

export const getWorkOrderStatusMeta = (status: WorkOrderStatus | null) =>
  status ? WORK_ORDER_STATUS_META[status] : null;

export const getWorkOrderStatusLabel = (status: WorkOrderStatus | null) =>
  getWorkOrderStatusMeta(status)?.label ?? '—';

export const getAdminWorkOrderScanActionLabel = (action: AdminWorkOrderScanAction) => {
  switch (action) {
    case 'add_note':
      return '新增備註';
    case 'mark_delivered':
      return '標記已交件';
    case 'mark_paid':
      return '標記已付款';
    case 'open_detail':
      return '開啟完整工單';
    case 'update_status':
      return '更新狀態';
    default:
      return action;
  }
};

export const getBoardTypeLabel = (boardType: BoardType | null) =>
  boardType ? BOARD_TYPE_LABELS[boardType] : '—';

export const getBoardLengthClassLabel = (boardLengthClass: BoardLengthClass | null) =>
  boardLengthClass ? BOARD_LENGTH_CLASS_LABELS[boardLengthClass] : '—';

export const getBoardColorSwatchMeta = (color: string | null): BoardColorSwatchMeta | null => {
  const trimmedColor = color?.trim();

  if (!trimmedColor) {
    return null;
  }

  return (
    BOARD_COLOR_SWATCH_META[trimmedColor] ?? {
      label: trimmedColor,
      swatchClass: 'border-slate-300 bg-background',
    }
  );
};

export const getQuoteItemTypeLabel = (itemType: QuoteItemType | null) =>
  itemType ? QUOTE_ITEM_TYPE_LABELS[itemType] : '—';

export const getAdminWorkOrderDetailModeLabel = (mode: AdminWorkOrderDetailMode) =>
  DETAIL_MODE_LABELS[mode];

export const getWorkOrderFlagMeta = (flag: WorkOrderFlagKey) => WORK_ORDER_FLAG_META[flag];

export const getActiveWorkOrderFlags = (flags: WorkOrderListFlags) =>
  (
    ['overdueEstimatedCompletion', 'pickupOverdue', 'staleReceived'] as Array<WorkOrderFlagKey>
  ).filter((flag) => flags[flag]);

export const formatAdminDate = (value: string | null) => {
  if (!value) {
    return '—';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replaceAll('-', '/');
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return '—';
  }

  return DATE_TIME_FORMATTER.format(parsedValue).split(' ')[0] ?? '—';
};

export const formatAdminDateTime = (value: string | null) => {
  if (!value) {
    return '—';
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return '—';
  }

  return DATE_TIME_FORMATTER.format(parsedValue);
};

export const getAdminWorkOrderDetailPath = (
  id: string,
  mode: AdminWorkOrderDetailMode = DEFAULT_ADMIN_WORK_ORDER_DETAIL_MODE,
) => `/admin/work-orders/${encodeURIComponent(id)}?mode=${mode}`;

export const getAdminWorkOrderDetailAsyncKey = (id: string) => `admin-work-order-detail:${id}`;

export const createEmptyAdminWorkOrderEditFormState = (): AdminWorkOrderEditFormState => ({
  damageDescription: '',
  estimatedCompletionDate: '',
  internalNote: '',
  paymentReceived: false,
  pickupNote: '',
  publicNote: '',
  repairCount: '',
  repairCountSource: 'auto',
  repairMarks: [],
  storageFeeWarningAfterDays: '',
});

export const createEmptyAdminWorkOrderWorkFormState = (): AdminWorkOrderWorkFormState => ({
  internalNote: '',
  note: '',
  status: '',
});

export const createAdminWorkOrderEditFormState = (
  detail: AdminWorkOrderDetailItem,
): AdminWorkOrderEditFormState => ({
  damageDescription: detail.damageDescription ?? '',
  estimatedCompletionDate: detail.estimatedCompletionDate ?? '',
  internalNote: detail.internalNote ?? '',
  paymentReceived: detail.paymentReceived === true,
  pickupNote: detail.pickupInfo.pickupNote ?? '',
  publicNote: detail.publicNote ?? '',
  repairCount: detail.repairCount === null ? '' : String(detail.repairCount),
  repairCountSource: detail.repairCountSource ?? 'auto',
  repairMarks: (detail.repairMarks ?? []).map((mark) => ({ ...mark })),
  storageFeeWarningAfterDays:
    detail.pickupInfo.storageFeeWarningAfterDays === null
      ? ''
      : String(detail.pickupInfo.storageFeeWarningAfterDays),
});

export const normalizeAdminWorkOrderEditFormState = (
  formState: AdminWorkOrderEditFormState,
): AdminWorkOrderEditNormalizedSnapshot => ({
  damageDescription: normalizeNullableText(formState.damageDescription),
  estimatedCompletionDate: normalizeNullableDate(formState.estimatedCompletionDate),
  internalNote: normalizeNullableText(formState.internalNote),
  paymentReceived: formState.paymentReceived,
  pickupNote: normalizeNullableText(formState.pickupNote),
  publicNote: normalizeNullableText(formState.publicNote),
  repairCount: formState.repairCount.trim(),
  repairCountSource: formState.repairCountSource,
  repairMarks: formState.repairMarks.map((mark) => ({ ...mark })),
  storageFeeWarningAfterDays: normalizeStorageFeeWarningInput(formState.storageFeeWarningAfterDays),
});

export const getAdminWorkOrderEditDirtyFields = (
  baseline: AdminWorkOrderEditNormalizedSnapshot,
  current: AdminWorkOrderEditNormalizedSnapshot,
): AdminWorkOrderEditableField[] =>
  ADMIN_WORK_ORDER_EDITABLE_FIELDS.filter((field) =>
    field === 'repairMarks'
      ? JSON.stringify(baseline.repairMarks) !== JSON.stringify(current.repairMarks)
      : baseline[field] !== current[field],
  );

export const buildAdminWorkOrderEditPatchPayload = (
  baseline: AdminWorkOrderEditNormalizedSnapshot,
  current: AdminWorkOrderEditNormalizedSnapshot,
) => {
  const fieldErrors: Record<string, string[]> = {};
  const payload: AdminWorkOrderPatchPayload = {};
  const dirtyFields = getAdminWorkOrderEditDirtyFields(baseline, current);

  for (const field of dirtyFields) {
    if (field === 'estimatedCompletionDate') {
      if (
        current.estimatedCompletionDate !== null &&
        !/^\d{4}-\d{2}-\d{2}$/.test(current.estimatedCompletionDate)
      ) {
        fieldErrors.estimatedCompletionDate = ['請輸入有效日期。'];
        continue;
      }

      payload.estimatedCompletionDate = current.estimatedCompletionDate;
      continue;
    }

    if (field === 'damageDescription') {
      payload.damageDescription = current.damageDescription;
      continue;
    }

    if (field === 'paymentReceived') {
      payload.paymentReceived = current.paymentReceived;
      continue;
    }

    if (field === 'repairCount') {
      if (current.repairCount !== '' && !/^\d+$/.test(current.repairCount)) {
        fieldErrors.repairCount = ['請輸入正整數。'];
        continue;
      }

      payload.repairCount = current.repairCount === '' ? null : Number.parseInt(current.repairCount, 10);
      continue;
    }

    if (field === 'repairCountSource') {
      payload.repairCountSource = current.repairCountSource;
      continue;
    }

    if (field === 'repairMarks') {
      payload.repairMarks = current.repairMarks.map((mark) => ({ ...mark }));
      continue;
    }

    if (field === 'publicNote') {
      payload.publicNote = current.publicNote;
      continue;
    }

    if (field === 'internalNote') {
      payload.internalNote = current.internalNote;
      continue;
    }

    if (field === 'pickupNote') {
      payload.pickupNote = current.pickupNote;
      continue;
    }

    if (field === 'storageFeeWarningAfterDays') {
      if (!/^\d+$/.test(current.storageFeeWarningAfterDays)) {
        fieldErrors.storageFeeWarningAfterDays = ['請輸入正整數天數。'];
        continue;
      }

      const parsedValue = Number.parseInt(current.storageFeeWarningAfterDays, 10);
      const parsedPayload = editPayloadSchema.safeParse({
        storageFeeWarningAfterDays: parsedValue,
      });

      if (!parsedPayload.success) {
        fieldErrors.storageFeeWarningAfterDays = ['提醒天數必須介於 1 到 32767。'];
        continue;
      }

      payload.storageFeeWarningAfterDays = parsedValue;
    }
  }

  const parsedPayload = editPayloadSchema.safeParse(payload);

  if (current.repairCountSource === 'manual' && !payload.repairCount && current.repairCount === '') {
    fieldErrors.repairCount ??= [];
    fieldErrors.repairCount.push('手動模式需要填寫維修處數。');
  }

  if (!parsedPayload.success) {
    for (const issue of parsedPayload.error.issues) {
      const field = issue.path[0];

      if (typeof field === 'string') {
        fieldErrors[field] ??= [];
        fieldErrors[field].push(issue.message);
      }
    }
  }

  return {
    dirtyFields,
    fieldErrors,
    payload,
  };
};

export const isWorkOrderStatusBlockedForBoardType = (
  boardType: BoardType | null,
  status: WorkOrderStatus,
) => boardType === 'SNOWBOARD' && status === 'DRYING';

export const buildAdminWorkOrderStatusTransitionPayload = (
  formState: AdminWorkOrderWorkFormState,
) => {
  const fieldErrors: Record<string, string[]> = {};

  if (!formState.status) {
    fieldErrors.status = ['請選擇狀態。'];
  }

  const payload: AdminWorkOrderStatusTransitionPayload = {
    note: normalizeNullableText(formState.note),
    status: (formState.status || 'RECEIVED') as WorkOrderStatus,
  };

  const normalizedInternalNote = normalizeNullableText(formState.internalNote);

  if (normalizedInternalNote) {
    payload.internalNote = normalizedInternalNote;
  }

  const parsedPayload = statusTransitionPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    for (const issue of parsedPayload.error.issues) {
      const field = issue.path[0];

      if (typeof field === 'string') {
        fieldErrors[field] ??= [];
        fieldErrors[field].push(issue.message);
      }
    }
  }

  return {
    fieldErrors,
    payload: Object.keys(fieldErrors).length > 0 ? null : payload,
  };
};

export const hasAdvancedFilters = (query: AdminWorkOrderListQueryState) =>
  query.overdueEstimatedCompletion || query.pickupOverdue || query.staleReceived;

export const hasActiveFilters = (query: AdminWorkOrderListQueryState) =>
  Boolean(query.q || query.status || query.customerPhone || hasAdvancedFilters(query));

export const buildAdminWorkOrderListApiQuery = (query: AdminWorkOrderListQueryState) => {
  const apiQuery: Record<string, string> = {
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
  };

  if (query.q) {
    apiQuery.q = query.q;
  }

  if (query.status) {
    apiQuery.status = query.status;
  }

  if (query.customerPhone) {
    apiQuery.customerPhone = query.customerPhone;
  }

  if (query.overdueEstimatedCompletion) {
    apiQuery.overdueEstimatedCompletion = 'true';
  }

  if (query.pickupOverdue) {
    apiQuery.pickupOverdue = 'true';
  }

  if (query.staleReceived) {
    apiQuery.staleReceived = 'true';
  }

  return apiQuery;
};

export const serializeAdminWorkOrderListQuery = (
  query: AdminWorkOrderListQueryState,
): LocationQueryRaw => {
  const serializedQuery: LocationQueryRaw = {};

  if (query.page > DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE) {
    serializedQuery.page = String(query.page);
  }

  if (query.pageSize !== DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE_SIZE) {
    serializedQuery.pageSize = String(query.pageSize);
  }

  if (query.sort !== DEFAULT_ADMIN_WORK_ORDER_LIST_SORT) {
    serializedQuery.sort = query.sort;
  }

  if (query.q) {
    serializedQuery.q = query.q;
  }

  if (query.status) {
    serializedQuery.status = query.status;
  }

  if (query.customerPhone) {
    serializedQuery.customerPhone = query.customerPhone;
  }

  if (query.overdueEstimatedCompletion) {
    serializedQuery.overdueEstimatedCompletion = 'true';
  }

  if (query.pickupOverdue) {
    serializedQuery.pickupOverdue = 'true';
  }

  if (query.staleReceived) {
    serializedQuery.staleReceived = 'true';
  }

  return serializedQuery;
};

export const normalizeAdminWorkOrderListRouteQuery = (
  routeQuery: LocationQuery | LocationQueryRaw,
) => {
  const rawPage = getSingleQueryValue(routeQuery.page);
  const rawPageSize = getSingleQueryValue(routeQuery.pageSize);
  const rawSort = getSingleQueryValue(routeQuery.sort);
  const rawStatus = getSingleQueryValue(routeQuery.status);
  const rawQ = trimQueryValue(getSingleQueryValue(routeQuery.q));
  const rawCustomerPhone = trimQueryValue(getSingleQueryValue(routeQuery.customerPhone));
  const rawOverdueEstimatedCompletion = parseBooleanQueryValue(
    getSingleQueryValue(routeQuery.overdueEstimatedCompletion as QueryValue),
  );
  const rawPickupOverdue = parseBooleanQueryValue(
    getSingleQueryValue(routeQuery.pickupOverdue as QueryValue),
  );
  const rawStaleReceived = parseBooleanQueryValue(
    getSingleQueryValue(routeQuery.staleReceived as QueryValue),
  );
  const parsedPage = parsePositiveInteger(rawPage);
  const parsedPageSize = rawPageSize ? pageSizeSchema.safeParse(rawPageSize) : null;
  const parsedSort = rawSort ? sortValueSchema.safeParse(rawSort) : null;
  const parsedStatus = rawStatus ? statusValueSchema.safeParse(rawStatus) : null;

  const query: AdminWorkOrderListQueryState = {
    customerPhone: rawCustomerPhone,
    overdueEstimatedCompletion: rawOverdueEstimatedCompletion === true,
    page: parsedPage ?? DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE,
    pageSize: parsedPageSize?.success
      ? Number(parsedPageSize.data)
      : DEFAULT_ADMIN_WORK_ORDER_LIST_PAGE_SIZE,
    pickupOverdue: rawPickupOverdue === true,
    q: rawQ,
    sort: parsedSort?.success ? parsedSort.data : DEFAULT_ADMIN_WORK_ORDER_LIST_SORT,
    staleReceived: rawStaleReceived === true,
    status: parsedStatus?.success ? parsedStatus.data : undefined,
  };

  const canonicalQuery = serializeAdminWorkOrderListQuery(query);

  return {
    canonicalQuery,
    needsReplace:
      JSON.stringify(toComparableQuery(routeQuery)) !==
      JSON.stringify(toComparableQuery(canonicalQuery)),
    query,
  };
};

export const normalizeAdminWorkOrderDetailRouteQuery = (
  routeQuery: LocationQuery | LocationQueryRaw,
) => {
  const rawMode = trimQueryValue(getSingleQueryValue(routeQuery.mode));
  const parsedMode = rawMode ? detailModeValueSchema.safeParse(rawMode) : null;
  const mode = parsedMode?.success ? parsedMode.data : DEFAULT_ADMIN_WORK_ORDER_DETAIL_MODE;
  const canonicalQuery: LocationQueryRaw = {
    mode,
  };

  return {
    canonicalQuery,
    mode,
    needsReplace:
      JSON.stringify(toComparableQuery(routeQuery)) !==
      JSON.stringify(toComparableQuery(canonicalQuery)),
  };
};

export const getAdjustedPageForPageInfo = (page: number, pageInfo: PageInfo) => {
  if (pageInfo.totalPages > 0 && page > pageInfo.totalPages) {
    return pageInfo.totalPages;
  }

  return null;
};

export const getVisiblePageNumbers = (page: number, totalPages: number, maxVisible = 5) => {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisible / 2);
  let start = Math.max(1, page - halfWindow);
  let end = start + maxVisible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = end - maxVisible + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getApiErrorStatusCode = (error: unknown): number | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if (typeof error.status === 'number') {
    return error.status;
  }

  if (isRecord(error.response) && typeof error.response.status === 'number') {
    return error.response.status;
  }

  return undefined;
};

export const extractApiErrorEnvelope = (error: unknown): ApiErrorEnvelope | null => {
  if (!isRecord(error) || !isRecord(error.data) || !isRecord(error.data.error)) {
    return null;
  }

  const maybeEnvelope = error.data as unknown as ApiErrorEnvelope;

  return typeof maybeEnvelope.error.code === 'string' &&
    typeof maybeEnvelope.error.message === 'string'
    ? maybeEnvelope
    : null;
};
