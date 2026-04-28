import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import { z } from 'zod';
import type { Database } from '../../types/database.types';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type BoardType = Database['public']['Enums']['board_type'];

export interface WorkOrderListFlags {
  overdueEstimatedCompletion: boolean;
  pickupOverdue: boolean;
  staleReceived: boolean;
}

export interface AdminWorkOrderListItem {
  board: {
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
export const ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

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

export type AdminWorkOrderListSortValue =
  (typeof ADMIN_WORK_ORDER_LIST_SORT_OPTIONS)[number]['value'];

export type WorkOrderFlagKey = keyof WorkOrderListFlags;

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

export const getBoardTypeLabel = (boardType: BoardType | null) =>
  boardType ? BOARD_TYPE_LABELS[boardType] : '—';

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

export const getAdminWorkOrderDetailPath = (id: string) => `/admin/work-orders/${id}`;

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
