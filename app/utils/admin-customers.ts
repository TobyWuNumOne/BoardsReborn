import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import { z } from 'zod';
import type { Database } from '../../types/database.types';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];

export type AdminCustomerLineNotificationStatus =
  | 'not_notifyable'
  | 'notifyable'
  | 'unknown'
  | 'unlinked';
export type AdminCustomerLineStatusFilter = 'all' | 'linked' | 'not_notifyable' | 'unlinked';
export type AdminCustomerLineStatusTone = 'muted' | 'success' | 'warning';

export interface AdminCustomerPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminCustomerLineSummary {
  blockedAt: string | null;
  displayName: string | null;
  friendshipCheckedAt: string | null;
  isFriend: boolean | null;
  linkedAt: string | null;
  notificationStatus: Exclude<AdminCustomerLineNotificationStatus, 'unlinked'>;
  status: 'bound' | 'unbound';
}

export interface AdminCustomerLatestWorkOrderSummary {
  currentStatus: WorkOrderStatus | null;
  id: string | null;
  paperOrderNo: string | null;
  updatedAt: string | null;
}

export interface AdminCustomerListItem {
  activeWorkOrderCount: number;
  createdAt: string;
  id: string;
  latestWorkOrder: AdminCustomerLatestWorkOrderSummary | null;
  line: AdminCustomerLineSummary;
  name: string;
  note: string | null;
  phone: string;
  updatedAt: string;
  workOrderCount: number;
}

export interface AdminCustomerListResponse {
  data: AdminCustomerListItem[];
  pageInfo: AdminCustomerPageInfo;
}

export interface AdminCustomerDetailQueryState {
  page: number;
  pageSize: number;
}

export interface AdminCustomerDetailWorkOrderItem {
  currentStatus: WorkOrderStatus;
  id: string;
  paperOrderNo: string;
  updatedAt: string;
}

export interface AdminCustomerDetailResponse {
  data: {
    customer: {
      createdAt: string;
      id: string;
      name: string;
      note: string | null;
      phone: string;
      updatedAt: string;
    };
    line: AdminCustomerLineSummary;
    workOrders: {
      data: AdminCustomerDetailWorkOrderItem[];
      pageInfo: AdminCustomerPageInfo;
    };
  };
}

export interface AdminCustomerListQueryState {
  lineStatus: AdminCustomerLineStatusFilter;
  page: number;
  pageSize: number;
  q?: string;
  sort: AdminCustomerListSortValue;
}

export interface AdminCustomerApiErrorEnvelope {
  error: {
    code: string;
    fieldErrors?: Record<string, string[]>;
    message: string;
    requestId?: string;
  };
}

export const DEFAULT_ADMIN_CUSTOMER_LIST_PAGE = 1;
export const DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE = 20;
export const DEFAULT_ADMIN_CUSTOMER_LIST_SORT = 'updatedAt:desc';
export const ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export const ADMIN_CUSTOMER_LINE_STATUS_OPTIONS = [
  { label: '全部 LINE 狀態', value: 'all' },
  { label: '已綁定', value: 'linked' },
  { label: '未綁定', value: 'unlinked' },
  { label: '已綁定，不可通知', value: 'not_notifyable' },
] as const satisfies ReadonlyArray<{ label: string; value: AdminCustomerLineStatusFilter }>;

export const ADMIN_CUSTOMER_LIST_SORT_OPTIONS = [
  { label: '最近更新', value: 'updatedAt:desc' },
  { label: '最早更新', value: 'updatedAt:asc' },
  { label: '姓名（A-Z）', value: 'name:asc' },
  { label: '姓名（Z-A）', value: 'name:desc' },
  { label: '電話（小到大）', value: 'phone:asc' },
  { label: '電話（大到小）', value: 'phone:desc' },
  { label: '工單數（多到少）', value: 'workOrderCount:desc' },
  { label: '工單數（少到多）', value: 'workOrderCount:asc' },
  { label: '處理中工單（多到少）', value: 'activeWorkOrderCount:desc' },
  { label: '處理中工單（少到多）', value: 'activeWorkOrderCount:asc' },
  { label: '建立時間（新到舊）', value: 'createdAt:desc' },
  { label: '建立時間（舊到新）', value: 'createdAt:asc' },
] as const;

export type AdminCustomerListSortValue = (typeof ADMIN_CUSTOMER_LIST_SORT_OPTIONS)[number]['value'];

type QueryValue =
  | LocationQuery[string]
  | LocationQueryRaw[string]
  | Array<string | number | null | undefined>
  | string
  | number
  | null
  | undefined;

const sortValueSchema = z.enum(
  ADMIN_CUSTOMER_LIST_SORT_OPTIONS.map((option) => option.value) as [
    AdminCustomerListSortValue,
    ...AdminCustomerListSortValue[],
  ],
);

const lineStatusValueSchema = z.enum(
  ADMIN_CUSTOMER_LINE_STATUS_OPTIONS.map((option) => option.value) as [
    AdminCustomerLineStatusFilter,
    ...AdminCustomerLineStatusFilter[],
  ],
);

const pageSizeSchema = z.enum(
  ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS.map(String) as [
    `${(typeof ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS)[number]}`,
    ...Array<`${(typeof ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS)[number]}`>,
  ],
);

const LINE_STATUS_META: Record<
  AdminCustomerLineNotificationStatus,
  {
    badgeClass: string;
    label: string;
    tone: AdminCustomerLineStatusTone;
  }
> = {
  not_notifyable: {
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    label: '已綁定，不可通知',
    tone: 'warning',
  },
  notifyable: {
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    label: '已綁定，可通知',
    tone: 'success',
  },
  unknown: {
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    label: '已綁定，通知狀態未知',
    tone: 'muted',
  },
  unlinked: {
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    label: '未綁定',
    tone: 'muted',
  },
};

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

const toComparableQuery = (query: LocationQuery | LocationQueryRaw) =>
  Object.fromEntries(
    Object.entries(query)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );

export const createEmptyAdminCustomerListResponse = (
  page = DEFAULT_ADMIN_CUSTOMER_LIST_PAGE,
  pageSize = DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE,
): AdminCustomerListResponse => ({
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

export const getAdminCustomerDetailPath = (id: string) =>
  `/admin/customers/${encodeURIComponent(id)}`;

export const getAdminCustomerDetailAsyncKey = (
  id: string,
  query: AdminCustomerDetailQueryState,
) => `admin-customer-detail:${id}:${query.page}:${query.pageSize}`;

export const buildAdminCustomerDetailApiQuery = (query: AdminCustomerDetailQueryState) => ({
  page: String(query.page),
  pageSize: String(query.pageSize),
});

export const serializeAdminCustomerDetailQuery = (
  query: AdminCustomerDetailQueryState,
): LocationQueryRaw => {
  const serializedQuery: LocationQueryRaw = {};

  if (query.page > DEFAULT_ADMIN_CUSTOMER_LIST_PAGE) {
    serializedQuery.page = String(query.page);
  }

  if (query.pageSize !== DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE) {
    serializedQuery.pageSize = String(query.pageSize);
  }

  return serializedQuery;
};

export const normalizeAdminCustomerDetailRouteQuery = (
  routeQuery: LocationQuery | LocationQueryRaw,
) => {
  const rawPage = getSingleQueryValue(routeQuery.page);
  const rawPageSize = getSingleQueryValue(routeQuery.pageSize);
  const parsedPage = parsePositiveInteger(rawPage);
  const parsedPageSize = rawPageSize ? pageSizeSchema.safeParse(rawPageSize) : null;

  const query: AdminCustomerDetailQueryState = {
    page: parsedPage ?? DEFAULT_ADMIN_CUSTOMER_LIST_PAGE,
    pageSize: parsedPageSize?.success
      ? Number(parsedPageSize.data)
      : DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE,
  };

  const canonicalQuery = serializeAdminCustomerDetailQuery(query);

  return {
    canonicalQuery,
    needsReplace:
      JSON.stringify(toComparableQuery(routeQuery)) !==
      JSON.stringify(toComparableQuery(canonicalQuery)),
    query,
  };
};

export const createEmptyAdminCustomerDetailResponse = (
  page = DEFAULT_ADMIN_CUSTOMER_LIST_PAGE,
  pageSize = DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE,
): AdminCustomerDetailResponse => ({
  data: {
    customer: {
      createdAt: '',
      id: '',
      name: '',
      note: null,
      phone: '',
      updatedAt: '',
    },
    line: {
      blockedAt: null,
      displayName: null,
      friendshipCheckedAt: null,
      isFriend: null,
      linkedAt: null,
      notificationStatus: 'not_notifyable',
      status: 'unbound',
    },
    workOrders: {
      data: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: page > 1,
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      },
    },
  },
});

export const getCustomerLineStatusMeta = (input: {
  linked: boolean;
  notifyStatus?: AdminCustomerLineNotificationStatus | null;
}) => {
  if (!input.linked) {
    return LINE_STATUS_META.unlinked;
  }

  return LINE_STATUS_META[input.notifyStatus ?? 'unknown'] ?? LINE_STATUS_META.unknown;
};

export const getCustomerLineStatusLabel = (input: {
  linked: boolean;
  notifyStatus?: AdminCustomerLineNotificationStatus | null;
}) => getCustomerLineStatusMeta(input).label;

export const getCustomerLineStatusTone = (input: {
  linked: boolean;
  notifyStatus?: AdminCustomerLineNotificationStatus | null;
}) => getCustomerLineStatusMeta(input).tone;

export const hasActiveCustomerFilters = (query: AdminCustomerListQueryState) =>
  Boolean(query.q || query.lineStatus !== 'all');

export const buildAdminCustomerListApiQuery = (query: AdminCustomerListQueryState) => {
  const apiQuery: Record<string, string> = {
    lineStatus: query.lineStatus,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
  };

  if (query.q) {
    apiQuery.q = query.q;
  }

  return apiQuery;
};

export const serializeAdminCustomerListQuery = (
  query: AdminCustomerListQueryState,
): LocationQueryRaw => {
  const serializedQuery: LocationQueryRaw = {};

  if (query.page > DEFAULT_ADMIN_CUSTOMER_LIST_PAGE) {
    serializedQuery.page = String(query.page);
  }

  if (query.pageSize !== DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE) {
    serializedQuery.pageSize = String(query.pageSize);
  }

  if (query.sort !== DEFAULT_ADMIN_CUSTOMER_LIST_SORT) {
    serializedQuery.sort = query.sort;
  }

  if (query.lineStatus !== 'all') {
    serializedQuery.lineStatus = query.lineStatus;
  }

  if (query.q) {
    serializedQuery.q = query.q;
  }

  return serializedQuery;
};

export const normalizeAdminCustomerListRouteQuery = (
  routeQuery: LocationQuery | LocationQueryRaw,
) => {
  const rawPage = getSingleQueryValue(routeQuery.page);
  const rawPageSize = getSingleQueryValue(routeQuery.pageSize);
  const rawSort = getSingleQueryValue(routeQuery.sort);
  const rawLineStatus = getSingleQueryValue(routeQuery.lineStatus);
  const rawQ = trimQueryValue(getSingleQueryValue(routeQuery.q));
  const parsedPage = parsePositiveInteger(rawPage);
  const parsedPageSize = rawPageSize ? pageSizeSchema.safeParse(rawPageSize) : null;
  const parsedSort = rawSort ? sortValueSchema.safeParse(rawSort) : null;
  const parsedLineStatus = rawLineStatus ? lineStatusValueSchema.safeParse(rawLineStatus) : null;

  const query: AdminCustomerListQueryState = {
    lineStatus: parsedLineStatus?.success ? parsedLineStatus.data : 'all',
    page: parsedPage ?? DEFAULT_ADMIN_CUSTOMER_LIST_PAGE,
    pageSize: parsedPageSize?.success
      ? Number(parsedPageSize.data)
      : DEFAULT_ADMIN_CUSTOMER_LIST_PAGE_SIZE,
    q: rawQ,
    sort: parsedSort?.success ? parsedSort.data : DEFAULT_ADMIN_CUSTOMER_LIST_SORT,
  };

  const canonicalQuery = serializeAdminCustomerListQuery(query);

  return {
    canonicalQuery,
    needsReplace:
      JSON.stringify(toComparableQuery(routeQuery)) !==
      JSON.stringify(toComparableQuery(canonicalQuery)),
    query,
  };
};

export const getAdjustedPageForCustomerPageInfo = (
  requestedPage: number,
  pageInfo: AdminCustomerPageInfo,
) => {
  if (pageInfo.totalPages === 0) {
    return requestedPage === 1 ? null : 1;
  }

  if (requestedPage > pageInfo.totalPages) {
    return pageInfo.totalPages;
  }

  return null;
};

export const getVisibleCustomerPageNumbers = (page: number, totalPages: number) => {
  if (totalPages <= 0) {
    return [];
  }

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const extractAdminCustomerApiErrorEnvelope = (
  error: unknown,
): AdminCustomerApiErrorEnvelope | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const maybeData = 'data' in error ? (error as { data?: unknown }).data : null;

  if (!maybeData || typeof maybeData !== 'object' || !('error' in maybeData)) {
    return null;
  }

  return maybeData as AdminCustomerApiErrorEnvelope;
};

export const getAdminCustomerApiErrorStatusCode = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode;
  }

  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }

  return null;
};
