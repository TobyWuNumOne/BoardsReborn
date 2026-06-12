import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import type { Database } from '../../types/database.types';

type PrintJobStatus = Database['public']['Enums']['print_job_status'];
export type PrintJobType = Database['public']['Enums']['print_job_type'];
type PrintDeviceStatus = Database['public']['Enums']['print_device_status'];
export type PrintDeviceConnectionState = 'online' | 'offline' | 'stale' | 'inactive' | 'error';
type BoardType = Database['public']['Enums']['board_type'];
type BoardLengthClass = Database['public']['Enums']['board_length_class'];

export interface AdminListPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminPrintJobListItem {
  attemptCount: number;
  board: {
    boardLengthClass: BoardLengthClass | null;
    boardType: BoardType | null;
  };
  createdAt: string;
  customer: {
    name: string | null;
  };
  device: {
    id: string;
    name: string | null;
  } | null;
  id: string;
  jobType: PrintJobType;
  lastError: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  maxAttempts: number;
  printedAt: string | null;
  status: PrintJobStatus;
  updatedAt: string;
  workOrder: {
    id: string;
    paperOrderNo: string;
  };
}

export interface AdminPrintJobListResponse {
  data: AdminPrintJobListItem[];
  pageInfo: AdminListPageInfo;
}

export interface AdminPrintDeviceListItem {
  createdAt: string;
  currentJob: {
    id: string;
    lockedAt: string | null;
    paperOrderNo: string | null;
    status: PrintJobStatus | null;
    workOrderId: string | null;
  } | null;
  deviceKey: string;
  id: string;
  lastSeenAt: string | null;
  location: string | null;
  name: string;
  recentError: {
    jobId: string | null;
    message: string;
    updatedAt: string | null;
  } | null;
  status: PrintDeviceStatus;
  updatedAt: string;
}

export interface AdminPrintDeviceListResponse {
  data: AdminPrintDeviceListItem[];
  pageInfo: AdminListPageInfo;
}

export interface AdminPrintSummaryLatestJob {
  attemptCount: number;
  createdAt: string;
  id: string;
  lastError: string | null;
  maxAttempts: number;
  printedAt: string | null;
  status: PrintJobStatus;
  updatedAt: string;
}

export interface AdminPrintSummaryItem {
  hasActiveJob: boolean;
  hasFailedJob: boolean;
  hasPendingJob: boolean;
  latestJob: AdminPrintSummaryLatestJob | null;
  reprintAllowed: boolean;
  workOrderId: string;
}

export interface AdminPrintSummaryResponse {
  data: Record<string, AdminPrintSummaryItem>;
}

export interface AdminPrintJobListQueryState {
  page: number;
  pageSize: number;
  paperOrderNo?: string;
  sort: AdminPrintJobListSortValue;
  status?: PrintJobStatus;
}

export interface AdminPrintDeviceListQueryState {
  page: number;
  pageSize: number;
  q?: string;
  sort: AdminPrintDeviceListSortValue;
  status?: PrintDeviceStatus;
}

export type AdminPrintDeviceUpdatePayload = Partial<{
  location: string | null;
  name: string;
  status: PrintDeviceStatus;
}>;

export interface AdminPrintDeviceCreatePayload {
  deviceKey: string;
  location?: string | null;
  name: string;
  status: PrintDeviceStatus;
}

export const DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE = 1;
export const DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_PRINT_JOB_LIST_SORT = 'createdAt:desc';
export const DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE = 1;
export const DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_PRINT_DEVICE_LIST_SORT = 'updatedAt:desc';
export const ADMIN_PRINT_LIST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export const ADMIN_PRINT_JOB_STATUS_OPTIONS = [
  { label: '待列印', value: 'pending' },
  { label: '已鎖定', value: 'locked' },
  { label: '列印中', value: 'printing' },
  { label: '已完成', value: 'printed' },
  { label: '失敗', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
] as const satisfies ReadonlyArray<{ label: string; value: PrintJobStatus }>;

export const ADMIN_PRINT_DEVICE_STATUS_OPTIONS = [
  { label: '啟用中', value: 'active' },
  { label: '已停用', value: 'inactive' },
  { label: '異常', value: 'error' },
] as const satisfies ReadonlyArray<{ label: string; value: PrintDeviceStatus }>;

export type AdminPrintDeviceStatusValue =
  (typeof ADMIN_PRINT_DEVICE_STATUS_OPTIONS)[number]['value'];

export const ADMIN_PRINT_JOB_SORT_OPTIONS = [
  { label: '最新建立', value: 'createdAt:desc' },
  { label: '最早建立', value: 'createdAt:asc' },
  { label: '最近更新', value: 'updatedAt:desc' },
  { label: '最早更新', value: 'updatedAt:asc' },
] as const;

export const ADMIN_PRINT_DEVICE_SORT_OPTIONS = [
  { label: '最近更新', value: 'updatedAt:desc' },
  { label: '最早更新', value: 'updatedAt:asc' },
  { label: '最近心跳', value: 'lastSeenAt:desc' },
  { label: '最久未回報', value: 'lastSeenAt:asc' },
  { label: '名稱（A-Z）', value: 'name:asc' },
  { label: '名稱（Z-A）', value: 'name:desc' },
  { label: '狀態（A-Z）', value: 'status:asc' },
  { label: '狀態（Z-A）', value: 'status:desc' },
  { label: '最新建立', value: 'createdAt:desc' },
  { label: '最早建立', value: 'createdAt:asc' },
] as const;

export type AdminPrintJobListSortValue = (typeof ADMIN_PRINT_JOB_SORT_OPTIONS)[number]['value'];
export type AdminPrintDeviceListSortValue =
  (typeof ADMIN_PRINT_DEVICE_SORT_OPTIONS)[number]['value'];

const PRINT_JOB_STATUS_LABELS: Record<PrintJobStatus, string> = {
  cancelled: '已取消',
  failed: '失敗',
  locked: '已鎖定',
  pending: '待列印',
  printed: '已完成',
  printing: '列印中',
};

const PRINT_DEVICE_STATUS_LABELS: Record<PrintDeviceStatus, string> = {
  active: '啟用中',
  error: '異常',
  inactive: '已停用',
};

const PRINT_DEVICE_CONNECTION_STATE_LABELS: Record<PrintDeviceConnectionState, string> = {
  error: '錯誤',
  inactive: '停用',
  offline: '離線',
  online: '在線',
  stale: '心跳過期',
};

const PRINT_JOB_STATUS_TONES: Record<PrintJobStatus, StatusTone> = {
  cancelled: 'inactive',
  failed: 'danger',
  locked: 'warning',
  pending: 'muted',
  printed: 'success',
  printing: 'warning',
};

const PRINT_DEVICE_STATUS_TONES: Record<PrintDeviceStatus, StatusTone> = {
  active: 'success',
  error: 'danger',
  inactive: 'inactive',
};

const PRINT_DEVICE_CONNECTION_STATE_TONES: Record<PrintDeviceConnectionState, StatusTone> = {
  error: 'danger',
  inactive: 'inactive',
  offline: 'inactive',
  online: 'success',
  stale: 'warning',
};

type RouteQueryValue =
  | string
  | number
  | null
  | undefined
  | Array<string | number | null | undefined>;
export type StatusTone = 'danger' | 'inactive' | 'muted' | 'success' | 'warning';

const readSingleQueryValue = (value: RouteQueryValue) => {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return firstValue === null || firstValue === undefined ? undefined : String(firstValue);
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  return String(value);
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  return parsedValue > 0 ? parsedValue : fallback;
};

const parseOptionalEnum = <Value extends string>(
  value: string | undefined,
  allowedValues: readonly Value[],
) => {
  if (!value || !allowedValues.includes(value as Value)) {
    return undefined;
  }

  return value as Value;
};

const parseOptionalText = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
};

const isSameQuery = (
  left: LocationQuery | LocationQueryRaw,
  right: LocationQuery | LocationQueryRaw,
) => JSON.stringify(left) === JSON.stringify(right);

export const createEmptyAdminPrintJobListResponse = (
  page = DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE,
  pageSize = DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE_SIZE,
): AdminPrintJobListResponse => ({
  data: [],
  pageInfo: {
    hasNextPage: false,
    hasPreviousPage: false,
    page,
    pageSize,
    total: 0,
    totalPages: 0,
  },
});

export const createEmptyAdminPrintDeviceListResponse = (
  page = DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE,
  pageSize = DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE_SIZE,
): AdminPrintDeviceListResponse => ({
  data: [],
  pageInfo: {
    hasNextPage: false,
    hasPreviousPage: false,
    page,
    pageSize,
    total: 0,
    totalPages: 0,
  },
});

export const serializeAdminPrintJobListQuery = (
  query: AdminPrintJobListQueryState,
): LocationQueryRaw => ({
  page: query.page === DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE ? undefined : String(query.page),
  pageSize:
    query.pageSize === DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE_SIZE ? undefined : String(query.pageSize),
  paperOrderNo: query.paperOrderNo,
  sort: query.sort === DEFAULT_ADMIN_PRINT_JOB_LIST_SORT ? undefined : query.sort,
  status: query.status,
});

export const normalizeAdminPrintJobListRouteQuery = (query: LocationQuery | LocationQueryRaw) => {
  const normalizedQuery: AdminPrintJobListQueryState = {
    page: parsePositiveInteger(readSingleQueryValue(query.page), DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE),
    pageSize: parsePositiveInteger(
      readSingleQueryValue(query.pageSize),
      DEFAULT_ADMIN_PRINT_JOB_LIST_PAGE_SIZE,
    ),
    paperOrderNo: parseOptionalText(readSingleQueryValue(query.paperOrderNo)),
    sort:
      parseOptionalEnum(
        readSingleQueryValue(query.sort),
        ADMIN_PRINT_JOB_SORT_OPTIONS.map((option) => option.value),
      ) ?? DEFAULT_ADMIN_PRINT_JOB_LIST_SORT,
    status: parseOptionalEnum(
      readSingleQueryValue(query.status),
      ADMIN_PRINT_JOB_STATUS_OPTIONS.map((option) => option.value),
    ),
  };
  const canonicalQuery = serializeAdminPrintJobListQuery(normalizedQuery);

  return {
    canonicalQuery,
    needsReplace: !isSameQuery(canonicalQuery, query),
    query: normalizedQuery,
  };
};

export const buildAdminPrintJobListApiQuery = (query: AdminPrintJobListQueryState) => ({
  page: query.page,
  pageSize: query.pageSize,
  ...(query.paperOrderNo ? { paperOrderNo: query.paperOrderNo } : {}),
  ...(query.sort ? { sort: query.sort } : {}),
  ...(query.status ? { status: query.status } : {}),
});

export const hasActiveAdminPrintJobFilters = (query: AdminPrintJobListQueryState) =>
  Boolean(query.paperOrderNo || query.status);

export const serializeAdminPrintDeviceListQuery = (
  query: AdminPrintDeviceListQueryState,
): LocationQueryRaw => ({
  page: query.page === DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE ? undefined : String(query.page),
  pageSize:
    query.pageSize === DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE_SIZE
      ? undefined
      : String(query.pageSize),
  q: query.q,
  sort: query.sort === DEFAULT_ADMIN_PRINT_DEVICE_LIST_SORT ? undefined : query.sort,
  status: query.status,
});

export const normalizeAdminPrintDeviceListRouteQuery = (
  query: LocationQuery | LocationQueryRaw,
) => {
  const normalizedQuery: AdminPrintDeviceListQueryState = {
    page: parsePositiveInteger(
      readSingleQueryValue(query.page),
      DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE,
    ),
    pageSize: parsePositiveInteger(
      readSingleQueryValue(query.pageSize),
      DEFAULT_ADMIN_PRINT_DEVICE_LIST_PAGE_SIZE,
    ),
    q: parseOptionalText(readSingleQueryValue(query.q)),
    sort:
      parseOptionalEnum(
        readSingleQueryValue(query.sort),
        ADMIN_PRINT_DEVICE_SORT_OPTIONS.map((option) => option.value),
      ) ?? DEFAULT_ADMIN_PRINT_DEVICE_LIST_SORT,
    status: parseOptionalEnum(
      readSingleQueryValue(query.status),
      ADMIN_PRINT_DEVICE_STATUS_OPTIONS.map((option) => option.value),
    ),
  };
  const canonicalQuery = serializeAdminPrintDeviceListQuery(normalizedQuery);

  return {
    canonicalQuery,
    needsReplace: !isSameQuery(canonicalQuery, query),
    query: normalizedQuery,
  };
};

export const buildAdminPrintDeviceListApiQuery = (query: AdminPrintDeviceListQueryState) => ({
  page: query.page,
  pageSize: query.pageSize,
  ...(query.q ? { q: query.q } : {}),
  ...(query.sort ? { sort: query.sort } : {}),
  ...(query.status ? { status: query.status } : {}),
});

export const hasActiveAdminPrintDeviceFilters = (query: AdminPrintDeviceListQueryState) =>
  Boolean(query.q || query.status);

export const getPrintJobStatusLabel = (status: PrintJobStatus) => PRINT_JOB_STATUS_LABELS[status];
export const getPrintDeviceStatusLabel = (status: PrintDeviceStatus) =>
  PRINT_DEVICE_STATUS_LABELS[status];
export const getPrintJobStatusTone = (status: PrintJobStatus) => PRINT_JOB_STATUS_TONES[status];
export const getPrintDeviceStatusTone = (status: PrintDeviceStatus) =>
  PRINT_DEVICE_STATUS_TONES[status];
const PRINT_JOB_TYPE_LABELS: Record<PrintJobType, string> = {
  customer_receipt: '顧客留存聯',
  work_order_label: '工單標籤',
};

export const getPrintJobTypeLabel = (jobType: PrintJobType) => PRINT_JOB_TYPE_LABELS[jobType];

interface GetPrintDeviceConnectionStateInput {
  lastSeenAt: string | null;
  now: Date;
  staleAfterSeconds: number;
  status: PrintDeviceStatus;
}

const parseHeartbeatDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsedTime = Date.parse(value);

  if (Number.isNaN(parsedTime)) {
    return null;
  }

  return new Date(parsedTime);
};

export const getPrintDeviceConnectionState = ({
  lastSeenAt,
  now,
  staleAfterSeconds,
  status,
}: GetPrintDeviceConnectionStateInput): PrintDeviceConnectionState => {
  if (status === 'error') {
    return 'error';
  }

  if (status === 'inactive') {
    return 'inactive';
  }

  const heartbeatDate = parseHeartbeatDate(lastSeenAt);

  if (!heartbeatDate) {
    return 'offline';
  }

  const staleAfterMilliseconds = staleAfterSeconds * 1000;
  const heartbeatAgeMilliseconds = now.getTime() - heartbeatDate.getTime();

  if (heartbeatAgeMilliseconds <= staleAfterMilliseconds) {
    return 'online';
  }

  return 'stale';
};

export const getPrintDeviceConnectionStateLabel = (state: PrintDeviceConnectionState) =>
  PRINT_DEVICE_CONNECTION_STATE_LABELS[state];

export const getPrintDeviceConnectionStateTone = (state: PrintDeviceConnectionState) =>
  PRINT_DEVICE_CONNECTION_STATE_TONES[state];

export const createEmptyAdminPrintSummary = (workOrderId: string): AdminPrintSummaryItem => ({
  hasActiveJob: false,
  hasFailedJob: false,
  hasPendingJob: false,
  latestJob: null,
  reprintAllowed: true,
  workOrderId,
});

export const getAdminPrintActionLabel = (summary: AdminPrintSummaryItem | null) =>
  summary?.latestJob ? '建立補印' : '建立列印任務';

export const getAdminPrintingCenterPath = (paperOrderNo: string | null | undefined) =>
  paperOrderNo?.trim()
    ? `/admin/printing?paperOrderNo=${encodeURIComponent(paperOrderNo)}`
    : '/admin/printing';
