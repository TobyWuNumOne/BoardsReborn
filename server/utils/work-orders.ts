import { InternalServerError, NotFoundError, ValidationError } from './api-errors';
import { normalizeTaiwanMobilePhone } from './phone';
import { throwMappedSupabaseError } from './supabase-errors';
import {
  type AdminWorkOrderScanQuickNoteInput,
  type BulkStatusInput,
  type PublicWorkOrderLookupInput,
  type RepairCountSource,
  STALE_RECEIVED_DAYS,
  type CreateWorkOrderInput,
  type PatchWorkOrderInput,
  type StatusTransitionInput,
  type WorkOrderListQuery,
} from './work-order-validation';
import type { ServiceRoleSupabaseClient, UserScopedSupabaseClient } from './supabase-clients';
import type { Database, Json } from '../../types/database.types';
import { enqueueInitialPrintJobForWorkOrder } from './print-jobs';

type AdminWorkOrderListRow = Database['public']['Views']['admin_work_order_list']['Row'];
type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type BoardType = Database['public']['Enums']['board_type'];
type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type WorkOrderBulkLookupRow = Pick<WorkOrderRow, 'id' | 'paper_order_no'>;
type QuoteItemRow = Pick<
  Database['public']['Tables']['quote_items']['Row'],
  'amount' | 'created_at' | 'description' | 'id' | 'item_type'
>;
type RepairMarkRow = Database['public']['Tables']['work_order_repair_marks']['Row'];
type InitialQuoteItemRow = Pick<Database['public']['Tables']['quote_items']['Row'], 'amount'>;
type StatusHistoryRow = Pick<
  Database['public']['Tables']['status_history']['Row'],
  'changed_at' | 'id' | 'note' | 'status'
>;

type WorkOrderWithCustomer = WorkOrderRow & {
  customers: Pick<CustomerRow, 'id' | 'name' | 'phone'> | null;
};
type ScanLookupWorkOrderRow = Pick<
  WorkOrderRow,
  | 'board_brand'
  | 'board_color'
  | 'board_length_class'
  | 'board_serial_label'
  | 'board_size_label'
  | 'board_type'
  | 'created_at'
  | 'current_status'
  | 'damage_description'
  | 'estimated_completion_date'
  | 'id'
  | 'intake_date'
  | 'internal_note'
  | 'paper_order_no'
  | 'payment_received'
  | 'pickup_note'
  | 'public_note'
  | 'updated_at'
> & {
  customers: Pick<CustomerRow, 'name' | 'phone'> | null;
};
type WorkOrderResolveRow = Pick<
  AdminWorkOrderListRow,
  | 'board_color'
  | 'board_length_class'
  | 'board_size_label'
  | 'board_type'
  | 'current_status'
  | 'customer_id'
  | 'customer_name'
  | 'customer_phone'
  | 'estimated_completion_date'
  | 'id'
  | 'is_overdue_estimated_completion'
  | 'is_pickup_overdue'
  | 'latest_received_at'
  | 'paper_order_no'
  | 'updated_at'
>;
type PublicLookupWorkOrderRow = Pick<
  WorkOrderRow,
  | 'board_type'
  | 'current_status'
  | 'estimated_completion_date'
  | 'id'
  | 'paper_order_no'
  | 'public_note'
  | 'repair_count'
  | 'repair_count_source'
  | 'updated_at'
> & {
  customers: Pick<CustomerRow, 'phone'> | null;
};

const DASHBOARD_OVERDUE_STATUSES = [
  'RECEIVED',
  'DRYING',
  'REPAIRING',
  'READY_FOR_PICKUP',
] as const satisfies ReadonlyArray<Database['public']['Enums']['work_order_status']>;

const PUBLIC_WORK_ORDER_LOOKUP_NOT_FOUND_MESSAGE = '查無符合的工單，請確認工單號與手機號碼。';
const PUBLIC_PROGRESS_STEP_ORDER_BY_BOARD_TYPE = {
  SNOWBOARD: ['RECEIVED', 'REPAIRING', 'READY_FOR_PICKUP', 'DELIVERED'],
  SUP: ['RECEIVED', 'DRYING', 'REPAIRING', 'READY_FOR_PICKUP', 'DELIVERED'],
  SURFBOARD: ['RECEIVED', 'DRYING', 'REPAIRING', 'READY_FOR_PICKUP', 'DELIVERED'],
} as const satisfies Record<
  BoardType,
  ReadonlyArray<'DELIVERED' | 'DRYING' | 'READY_FOR_PICKUP' | 'RECEIVED' | 'REPAIRING'>
>;
const PUBLIC_STATUS_LABELS = {
  CANCELLED: '已取消',
  DELIVERED: '已交件',
  DRYING: '除濕中',
  READY_FOR_PICKUP: '待取件',
  RECEIVED: '已收件',
  REPAIRING: '維修中',
} as const satisfies Record<WorkOrderStatus, string>;

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type BulkStatusSkipReason = 'INVALID_STATUS_TRANSITION' | 'NOT_FOUND';
export type AdminWorkOrderScanAction =
  | 'add_note'
  | 'mark_delivered'
  | 'mark_paid'
  | 'open_detail'
  | 'update_status';
export type PublicProgressStepState = 'current' | 'done' | 'upcoming';
export type PublicProgressStepKey =
  | 'DELIVERED'
  | 'DRYING'
  | 'READY_FOR_PICKUP'
  | 'RECEIVED'
  | 'REPAIRING';
export type PublicWorkOrderProgress =
  | {
      currentStepKey: PublicProgressStepKey;
      kind: 'timeline';
      steps: Array<{
        key: PublicProgressStepKey;
        label: string;
        state: PublicProgressStepState;
      }>;
    }
  | {
      kind: 'cancelled';
      message: string;
    };

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
    boardLengthClass: WorkOrderRow['board_length_class'];
    brand: string | null;
    color: string | null;
    damageDescription: string | null;
    serialLabel: string | null;
    sizeLabel: string | null;
    type: BoardType;
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toJsonObject = (value: unknown): Json => value as Json;

const getTaipeiDateParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Taipei',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    year <= 0 ||
    month <= 0 ||
    day <= 0
  ) {
    throw new InternalServerError('Unable to calculate Taipei date range.');
  }

  return { day, month, year };
};

export const getTaipeiDayRange = (date = new Date()) => {
  const parts = getTaipeiDateParts(date);
  const startOfDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, -8, 0, 0, 0));
  const nextDay = new Date(startOfDay.getTime() + DAY_IN_MS);

  return {
    endExclusive: nextDay.toISOString(),
    startInclusive: startOfDay.toISOString(),
  };
};

const getExactCount = async (
  query: PromiseLike<{
    count: number | null;
    error: unknown;
  }>,
) => {
  const { count, error } = await query;

  if (error) {
    throwMappedSupabaseError(error);
  }

  return count ?? 0;
};

const calculatePageInfo = (page: number, pageSize: number, total: number): PageInfo => {
  const totalPages = Math.ceil(total / pageSize);

  return {
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    page,
    pageSize,
    total,
    totalPages,
  };
};

const calculateQuoteTotal = (quoteItems: QuoteItemRow[]): number =>
  quoteItems.reduce((total, quoteItem) => total + quoteItem.amount, 0);

const normalizeRepairCount = (count: number | null, source: RepairCountSource, markCount: number) => {
  if (source === 'manual') {
    return count;
  }

  return markCount > 0 ? markCount : null;
};

const mapRepairMark = (mark: RepairMarkRow) => ({
  boardSide: mark.board_side,
  heightRatio: mark.height_ratio,
  id: mark.id,
  sortOrder: mark.sort_order,
  templateKey: mark.template_key,
  widthRatio: mark.width_ratio,
  xRatio: mark.x_ratio,
  yRatio: mark.y_ratio,
});

const replaceRepairMarks = async (
  supabase: ServiceRoleSupabaseClient | UserScopedSupabaseClient,
  workOrderId: string,
  marks: CreateWorkOrderInput['repairMarks'],
) => {
  const { error: deleteError } = await supabase
    .from('work_order_repair_marks')
    .delete()
    .eq('work_order_id', workOrderId);

  if (deleteError) {
    throwMappedSupabaseError(deleteError);
  }

  if (marks.length === 0) {
    return;
  }

  const payload: Database['public']['Tables']['work_order_repair_marks']['Insert'][] = marks.map(
    (mark) => ({
      board_side: mark.boardSide,
      height_ratio: mark.heightRatio,
      sort_order: mark.sortOrder,
      template_key: mark.templateKey,
      width_ratio: mark.widthRatio,
      work_order_id: workOrderId,
      x_ratio: mark.xRatio,
      y_ratio: mark.yRatio,
    }),
  );

  const { error: insertError } = await supabase.from('work_order_repair_marks').insert(payload);

  if (insertError) {
    throwMappedSupabaseError(insertError);
  }
};

export const getPublicWorkOrderStatusLabel = (status: WorkOrderStatus) =>
  PUBLIC_STATUS_LABELS[status];

export const buildPublicWorkOrderProgress = (
  boardType: BoardType,
  currentStatus: WorkOrderStatus,
): PublicWorkOrderProgress => {
  if (currentStatus === 'CANCELLED') {
    return {
      kind: 'cancelled',
      message: '此工單已取消',
    };
  }

  const stepOrder = PUBLIC_PROGRESS_STEP_ORDER_BY_BOARD_TYPE[
    boardType
  ] as ReadonlyArray<PublicProgressStepKey>;
  const currentStepKey = (
    stepOrder.includes(currentStatus as PublicProgressStepKey)
      ? currentStatus
      : boardType === 'SNOWBOARD' && currentStatus === 'DRYING'
        ? 'REPAIRING'
        : 'RECEIVED'
  ) as PublicProgressStepKey;
  const currentStepIndex = stepOrder.indexOf(currentStepKey);

  return {
    currentStepKey,
    kind: 'timeline',
    steps: stepOrder.map((stepKey, index) => ({
      key: stepKey,
      label: PUBLIC_STATUS_LABELS[stepKey],
      state:
        index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'upcoming',
    })),
  };
};

const calculateDaysWaitingForPickup = (
  notifiedAt: string | null,
  pickedUpAt: string | null,
  now = new Date(),
): number => {
  if (!notifiedAt || pickedUpAt) {
    return 0;
  }

  const notifiedAtDate = new Date(notifiedAt);

  if (Number.isNaN(notifiedAtDate.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - notifiedAtDate.getTime()) / DAY_IN_MS));
};

const isPickupOverdue = (
  notifiedAt: string | null,
  pickedUpAt: string | null,
  storageFeeWarningAfterDays: number,
  now = new Date(),
): boolean => {
  if (!notifiedAt || pickedUpAt) {
    return false;
  }

  return calculateDaysWaitingForPickup(notifiedAt, pickedUpAt, now) >= storageFeeWarningAfterDays;
};

const isStaleReceived = (
  latestReceivedAt: string | null,
  currentStatus: AdminWorkOrderListRow['current_status'],
  now = new Date(),
) => {
  if (currentStatus !== 'RECEIVED' || !latestReceivedAt) {
    return false;
  }

  const latestReceivedDate = new Date(latestReceivedAt);

  if (Number.isNaN(latestReceivedDate.getTime())) {
    return false;
  }

  return now.getTime() - latestReceivedDate.getTime() >= STALE_RECEIVED_DAYS * DAY_IN_MS;
};

export const mapWorkOrderListRow = (row: AdminWorkOrderListRow, now = new Date()) => ({
  board: {
    color: row.board_color,
    boardLengthClass: row.board_length_class,
    boardType: row.board_type,
    sizeLabel: row.board_size_label,
  },
  currentStatus: row.current_status,
  customer: {
    id: row.customer_id,
    name: row.customer_name,
    phone: row.customer_phone,
  },
  estimatedCompletionDate: row.estimated_completion_date,
  flags: {
    overdueEstimatedCompletion: row.is_overdue_estimated_completion ?? false,
    pickupOverdue: row.is_pickup_overdue ?? false,
    staleReceived: isStaleReceived(row.latest_received_at, row.current_status, now),
  },
  id: row.id,
  intakeDate: row.intake_date,
  lastUpdatedAt: row.updated_at,
  paperOrderNo: row.paper_order_no,
  repairCount: row.repair_count,
  paymentReceived: row.payment_received,
  paymentReceivedAt: row.payment_received_at,
  quoteTotalAmount: row.quote_total_amount,
  readyForPickupAt: row.ready_for_pickup_at,
});

export const mapWorkOrderResolveRow = (row: WorkOrderResolveRow, now = new Date()) => {
  if (!row.id || !row.paper_order_no || !row.current_status || !row.customer_id) {
    throw new InternalServerError();
  }

  return {
    board: {
      color: row.board_color,
      boardLengthClass: row.board_length_class,
      boardType: row.board_type,
      sizeLabel: row.board_size_label,
    },
    currentStatus: row.current_status,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      phone: row.customer_phone,
    },
    estimatedCompletionDate: row.estimated_completion_date,
    flags: {
      overdueEstimatedCompletion: row.is_overdue_estimated_completion ?? false,
      pickupOverdue: row.is_pickup_overdue ?? false,
      staleReceived: isStaleReceived(row.latest_received_at, row.current_status, now),
    },
    id: row.id,
    lastUpdatedAt: row.updated_at,
    paperOrderNo: row.paper_order_no,
  };
};

const isInvalidStatusTransitionValidation = (
  error: unknown,
): error is ValidationError & { fieldErrors: { status: string[] } } =>
  error instanceof ValidationError && Boolean(error.fieldErrors?.status);

const mapQuoteItem = (quoteItem: QuoteItemRow) => ({
  amount: quoteItem.amount,
  createdAt: quoteItem.created_at,
  description: quoteItem.description,
  id: quoteItem.id,
  itemType: quoteItem.item_type,
});

const mapStatusHistory = (statusHistory: StatusHistoryRow) => ({
  changedAt: statusHistory.changed_at,
  id: statusHistory.id,
  note: statusHistory.note,
  status: statusHistory.status,
});

const calculateDaysInShop = (intakeDate: string | null, now = new Date()) => {
  if (!intakeDate) {
    return null;
  }

  const intakeDateTime = new Date(`${intakeDate}T00:00:00.000+08:00`);

  if (Number.isNaN(intakeDateTime.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - intakeDateTime.getTime()) / DAY_IN_MS));
};

const calculateQuoteBreakdown = (quoteItems: QuoteItemRow[]) => {
  let initialQuoteAmount: number | null = null;
  let additionalAmount = 0;
  let hasAdditionalAmount = false;

  for (const quoteItem of quoteItems) {
    if (quoteItem.item_type === 'INITIAL') {
      initialQuoteAmount = quoteItem.amount;
      continue;
    }

    additionalAmount += quoteItem.amount;
    hasAdditionalAmount = true;
  }

  return {
    additionalAmount: hasAdditionalAmount ? additionalAmount : null,
    finalAmount: quoteItems.length > 0 ? calculateQuoteTotal(quoteItems) : null,
    initialQuoteAmount,
  };
};

export const getAdminWorkOrderScanAvailableActions = (
  status: WorkOrderStatus,
): AdminWorkOrderScanAction[] => {
  switch (status) {
    case 'RECEIVED':
    case 'DRYING':
    case 'REPAIRING':
      return ['update_status', 'add_note', 'open_detail'];
    case 'READY_FOR_PICKUP':
      return ['mark_paid', 'mark_delivered', 'add_note', 'open_detail'];
    case 'DELIVERED':
    case 'CANCELLED':
      return ['open_detail'];
    default:
      return ['open_detail'];
  }
};

export const getAdminWorkOrderScanAvailableStatusTransitions = (
  status: WorkOrderStatus,
): WorkOrderStatus[] => {
  switch (status) {
    case 'RECEIVED':
      return ['DRYING', 'REPAIRING'];
    case 'DRYING':
      return ['REPAIRING'];
    case 'REPAIRING':
      return ['READY_FOR_PICKUP'];
    default:
      return [];
  }
};

export const mapScanRecentHistory = (
  statusHistory: StatusHistoryRow[],
): AdminWorkOrderScanHistoryItem[] => {
  return statusHistory
    .map((item, index) => ({
      changedAt: item.changed_at as string,
      fromStatus: index > 0 ? (statusHistory[index - 1]?.status ?? null) : null,
      id: item.id as string,
      note: item.note,
      toStatus: item.status as WorkOrderStatus,
    }))
    .slice(-3)
    .reverse();
};

const mapWorkOrderDetail = (
  workOrder: WorkOrderWithCustomer,
  quoteItems: QuoteItemRow[],
  statusHistory: StatusHistoryRow[],
  repairMarks: RepairMarkRow[],
) => {
  if (!workOrder.customers) {
    throw new InternalServerError();
  }

  const normalizedRepairCount = normalizeRepairCount(
    workOrder.repair_count,
    workOrder.repair_count_source,
    repairMarks.length,
  );

  return {
    board: {
      boardLengthClass: workOrder.board_length_class,
      boardType: workOrder.board_type,
      brand: workOrder.board_brand,
      color: workOrder.board_color,
      model: workOrder.board_model,
      serialLabel: workOrder.board_serial_label,
      sizeLabel: workOrder.board_size_label,
    },
    currentStatus: workOrder.current_status,
    customer: {
      id: workOrder.customers.id,
      name: workOrder.customers.name,
      phone: workOrder.customers.phone,
    },
    damageDescription: workOrder.damage_description,
    estimatedCompletionDate: workOrder.estimated_completion_date,
    id: workOrder.id,
    intakeDate: workOrder.intake_date,
    internalNote: workOrder.internal_note,
    paperOrderNo: workOrder.paper_order_no,
    paymentReceived: workOrder.payment_received,
    paymentReceivedAt: workOrder.payment_received_at,
    pickupInfo: {
      daysWaitingForPickup: calculateDaysWaitingForPickup(
        workOrder.notified_at,
        workOrder.picked_up_at,
      ),
      isPickupOverdue: isPickupOverdue(
        workOrder.notified_at,
        workOrder.picked_up_at,
        workOrder.storage_fee_warning_after_days,
      ),
      notifiedAt: workOrder.notified_at,
      pickedUpAt: workOrder.picked_up_at,
      pickupNote: workOrder.pickup_note,
      storageFeeWarningAfterDays: workOrder.storage_fee_warning_after_days,
    },
    publicNote: workOrder.public_note,
    repairCount: normalizedRepairCount,
    repairCountSource: workOrder.repair_count_source,
    repairMarkCount: repairMarks.length,
    repairMarks: repairMarks.map(mapRepairMark),
    quoteItems: quoteItems.map(mapQuoteItem),
    quoteTotalAmount: calculateQuoteTotal(quoteItems),
    statusHistory: statusHistory.map(mapStatusHistory),
  };
};

const assertCreateResult = (value: unknown) => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('paperOrderNo' in value) ||
    !('currentStatus' in value) ||
    !('quoteTotalAmount' in value) ||
    !('createdAt' in value)
  ) {
    throw new InternalServerError();
  }

  return value as {
    createdAt: string;
    currentStatus: 'RECEIVED';
    id: string;
    paperOrderNo: string;
    quoteTotalAmount: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const mapStatusTransitionResult = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.workOrder) || !isRecord(value.statusHistory)) {
    throw new InternalServerError();
  }

  const { statusHistory, workOrder } = value;

  if (
    typeof workOrder.id !== 'string' ||
    typeof workOrder.paperOrderNo !== 'string' ||
    typeof workOrder.currentStatus !== 'string' ||
    !('readyForPickupAt' in workOrder) ||
    !('deliveredAt' in workOrder) ||
    !('cancelledAt' in workOrder) ||
    typeof workOrder.updatedAt !== 'string' ||
    typeof statusHistory.id !== 'string' ||
    typeof statusHistory.status !== 'string' ||
    typeof statusHistory.changedAt !== 'string' ||
    !('note' in statusHistory)
  ) {
    throw new InternalServerError();
  }

  return value as {
    statusHistory: {
      changedAt: string;
      id: string;
      note: string | null;
      status: Database['public']['Enums']['work_order_status'];
    };
    workOrder: {
      cancelledAt: string | null;
      currentStatus: Database['public']['Enums']['work_order_status'];
      deliveredAt: string | null;
      id: string;
      paperOrderNo: string;
      readyForPickupAt: string | null;
      updatedAt: string;
    };
  };
};

export const lookupAdminCustomers = async (
  supabase: UserScopedSupabaseClient,
  normalizedPhone: string,
) => {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, note, created_at')
    .eq('normalized_phone', normalizedPhone)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    data: (data ?? []).map((customer) => ({
      createdAt: customer.created_at,
      id: customer.id,
      name: customer.name,
      note: customer.note,
      phone: customer.phone,
    })),
  };
};

export const listAdminWorkOrders = async (
  supabase: UserScopedSupabaseClient,
  query: WorkOrderListQuery,
) => {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  let request = supabase.from('admin_work_order_list').select('*', { count: 'exact' });

  if (query.filters.status) {
    request = request.eq('current_status', query.filters.status);
  }

  if (query.q) {
    request = request.ilike('paper_order_no', `%${query.q}%`);
  }

  if (query.customerPhone) {
    request = request.eq('customer_normalized_phone', query.customerPhone);
  }

  if (query.filters.overdueEstimatedCompletion) {
    request = request.eq('is_overdue_estimated_completion', true);
  }

  if (query.filters.pickupOverdue) {
    request = request.eq('is_pickup_overdue', true);
  }

  if (query.filters.staleReceived) {
    request = request
      .eq('current_status', 'RECEIVED')
      .lt('latest_received_at', query.staleReceivedBefore);
  }

  const { count, data, error } = await request
    .order(query.sort.field, {
      ascending: query.sort.direction === 'asc',
      nullsFirst: false,
    })
    .range(from, to);

  if (error) {
    throwMappedSupabaseError(error);
  }

  const total = count ?? 0;

  return {
    data: (data ?? []).map((row) => mapWorkOrderListRow(row)),
    pageInfo: calculatePageInfo(query.page, query.pageSize, total),
  };
};

export const getAdminDashboardSummary = async (
  supabase: UserScopedSupabaseClient,
  now = new Date(),
) => {
  const taipeiDayRange = getTaipeiDayRange(now);
  const generatedAt = now.toISOString();

  const [received, drying, repairing, readyForPickup, overdue, createdToday] = await Promise.all([
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .eq('current_status', 'RECEIVED'),
    ),
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .eq('current_status', 'DRYING'),
    ),
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .eq('current_status', 'REPAIRING'),
    ),
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .eq('current_status', 'READY_FOR_PICKUP'),
    ),
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .eq('is_overdue_estimated_completion', true)
        .in('current_status', [...DASHBOARD_OVERDUE_STATUSES]),
    ),
    getExactCount(
      supabase
        .from('admin_work_order_list')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', taipeiDayRange.startInclusive)
        .lt('created_at', taipeiDayRange.endExclusive),
    ),
  ]);

  const activeWorkOrders = received + drying + repairing;

  return {
    data: {
      generatedAt,
      summary: {
        activeWorkOrders,
        activeWorkOrdersByStatus: {
          RECEIVED: received,
          DRYING: drying,
          REPAIRING: repairing,
        },
        createdToday,
        overdue,
        readyForPickup,
      },
    },
  };
};

export const resolveAdminWorkOrderByPaperOrderNo = async (
  supabase: UserScopedSupabaseClient,
  paperOrderNo: string,
) => {
  const { data, error } = await supabase
    .from('admin_work_order_list')
    .select('*')
    .eq('paper_order_no', paperOrderNo)
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    throw new NotFoundError('Work order not found.');
  }

  return {
    data: mapWorkOrderResolveRow(data as unknown as WorkOrderResolveRow),
  };
};

export const lookupPublicWorkOrder = async (
  supabase: ServiceRoleSupabaseClient,
  input: PublicWorkOrderLookupInput,
) => {
  const { data: workOrder, error: workOrderError } = await supabase
    .from('work_orders')
    .select(
      [
        'id',
        'paper_order_no',
        'current_status',
        'estimated_completion_date',
        'public_note',
        'updated_at',
        'board_type',
        'customers:customer_id(phone)',
      ].join(', '),
    )
    .eq('paper_order_no', input.paperOrderNo)
    .maybeSingle();

  if (workOrderError) {
    throwMappedSupabaseError(workOrderError);
  }

  if (!workOrder) {
    throw new NotFoundError(PUBLIC_WORK_ORDER_LOOKUP_NOT_FOUND_MESSAGE);
  }

  const publicLookupWorkOrder = workOrder as unknown as PublicLookupWorkOrderRow;
  const customerPhone = publicLookupWorkOrder.customers?.phone;

  if (!customerPhone || normalizeTaiwanMobilePhone(customerPhone) !== input.normalizedPhone) {
    throw new NotFoundError(PUBLIC_WORK_ORDER_LOOKUP_NOT_FOUND_MESSAGE);
  }

  const { data: initialQuote, error: quoteError } = await supabase
    .from('quote_items')
    .select('amount')
    .eq('work_order_id', publicLookupWorkOrder.id)
    .eq('item_type', 'INITIAL')
    .maybeSingle();

  if (quoteError) {
    throwMappedSupabaseError(quoteError);
  }

  const { data: repairMarks, error: repairMarksError } = await supabase
    .from('work_order_repair_marks')
    .select(
      'id, board_side, x_ratio, y_ratio, width_ratio, height_ratio, template_key, sort_order, created_at, updated_at',
    )
    .eq('work_order_id', publicLookupWorkOrder.id)
    .order('sort_order', { ascending: true });

  if (repairMarksError) {
    throwMappedSupabaseError(repairMarksError);
  }

  const typedRepairMarks = (repairMarks ?? []) as RepairMarkRow[];
  const repairMarkCount = typedRepairMarks.length;
  const repairCount = normalizeRepairCount(
    publicLookupWorkOrder.repair_count,
    publicLookupWorkOrder.repair_count_source,
    repairMarkCount,
  );

  return {
    data: {
      boardType: publicLookupWorkOrder.board_type,
      currentStatus: publicLookupWorkOrder.current_status,
      estimatedCompletionDate: publicLookupWorkOrder.estimated_completion_date,
      initialQuoteAmount: (initialQuote as InitialQuoteItemRow | null)?.amount ?? null,
      lastUpdatedAt: publicLookupWorkOrder.updated_at,
      paperOrderNo: publicLookupWorkOrder.paper_order_no,
      progress: buildPublicWorkOrderProgress(
        publicLookupWorkOrder.board_type,
        publicLookupWorkOrder.current_status,
      ),
      publicNote: publicLookupWorkOrder.public_note,
      repairCount,
      repairCountSource: publicLookupWorkOrder.repair_count_source,
      repairMarkCount,
      repairMarks: typedRepairMarks.map(mapRepairMark),
      statusLabel: getPublicWorkOrderStatusLabel(publicLookupWorkOrder.current_status),
    },
  };
};

export const createAdminWorkOrder = async (
  supabase: UserScopedSupabaseClient,
  input: CreateWorkOrderInput,
  userId: string,
) => {
  const repairMarks = input.repairMarks ?? [];
  const normalizedRepairCount = normalizeRepairCount(
    input.workOrder.repairCount ?? null,
    input.workOrder.repairCountSource ?? 'auto',
    repairMarks.length,
  );

  if (normalizedRepairCount === null) {
    throw new ValidationError({
      'workOrder.repairCount': ['Is required before creating a work order label.'],
    });
  }

  const { data, error } = await supabase.rpc('create_admin_work_order', {
    p_board: toJsonObject(input.board),
    p_created_by_user_id: userId,
    p_customer: toJsonObject(input.customer ?? null),
    p_customer_id: input.customerId,
    p_customer_mode: input.customerMode,
    p_quote_items: toJsonObject(input.quoteItems),
    p_work_order: toJsonObject(input.workOrder),
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = assertCreateResult(data);
  const { error: updateError } = await supabase
    .from('work_orders')
    .update({
      repair_count: normalizedRepairCount,
      repair_count_source: input.workOrder.repairCountSource ?? 'auto',
    })
    .eq('id', result.id);

  if (updateError) {
    throwMappedSupabaseError(updateError);
  }

  if (repairMarks.length > 0) {
    await replaceRepairMarks(supabase, result.id, repairMarks);
  }

  await enqueueInitialPrintJobForWorkOrder(supabase, result.id, userId);

  return {
    data: result,
  };
};

export const getAdminWorkOrderDetail = async (supabase: UserScopedSupabaseClient, id: string) => {
  const [
    { data: workOrder, error: workOrderError },
    { data: quoteItems, error: quoteItemsError },
    { data: statusHistory, error: statusHistoryError },
    { data: repairMarks, error: repairMarksError },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        [
          'id',
          'paper_order_no',
          'current_status',
          'customer_id',
          'board_type',
          'board_length_class',
          'board_brand',
          'board_model',
          'board_size_label',
          'board_color',
          'board_serial_label',
          'intake_date',
          'damage_description',
          'estimated_completion_date',
          'payment_received',
          'payment_received_at',
          'repair_count',
          'repair_count_source',
          'notified_at',
          'picked_up_at',
          'pickup_note',
          'storage_fee_warning_after_days',
          'public_note',
          'internal_note',
          'created_at',
          'updated_at',
          'customers:customer_id(id, name, phone)',
        ].join(', '),
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('quote_items')
      .select('id, item_type, description, amount, created_at')
      .eq('work_order_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('status_history')
      .select('id, status, changed_at, note')
      .eq('work_order_id', id)
      .order('changed_at', { ascending: true }),
    supabase
      .from('work_order_repair_marks')
      .select(
        'id, board_side, x_ratio, y_ratio, width_ratio, height_ratio, template_key, sort_order, created_at, updated_at',
      )
      .eq('work_order_id', id)
      .order('sort_order', { ascending: true }),
  ]);

  if (workOrderError) {
    throwMappedSupabaseError(workOrderError);
  }

  if (!workOrder) {
    throw new NotFoundError('Work order not found.');
  }

  if (quoteItemsError) {
    throwMappedSupabaseError(quoteItemsError);
  }

  if (statusHistoryError) {
    throwMappedSupabaseError(statusHistoryError);
  }

  if (repairMarksError) {
    throwMappedSupabaseError(repairMarksError);
  }

  return {
    data: mapWorkOrderDetail(
      workOrder as unknown as WorkOrderWithCustomer,
      (quoteItems ?? []) as QuoteItemRow[],
      (statusHistory ?? []) as StatusHistoryRow[],
      (repairMarks ?? []) as RepairMarkRow[],
    ),
  };
};

export const lookupAdminWorkOrderScan = async (
  supabase: UserScopedSupabaseClient,
  code: string,
  now = new Date(),
) => {
  const { data: resolveData, error: resolveError } = await supabase
    .from('admin_work_order_list')
    .select('*')
    .eq('paper_order_no', code)
    .maybeSingle();

  if (resolveError) {
    throwMappedSupabaseError(resolveError);
  }

  if (!resolveData?.id) {
    throw new NotFoundError('Work order not found.');
  }

  const detailId = resolveData.id;
  const [
    { data: workOrder, error: workOrderError },
    { data: quoteItems, error: quoteItemsError },
    { data: statusHistory, error: statusHistoryError },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        [
          'id',
          'paper_order_no',
          'current_status',
          'board_type',
          'board_length_class',
          'board_brand',
          'board_size_label',
          'board_color',
          'board_serial_label',
          'damage_description',
          'intake_date',
          'estimated_completion_date',
          'payment_received',
          'pickup_note',
          'public_note',
          'internal_note',
          'created_at',
          'updated_at',
          'customers:customer_id(name, phone)',
        ].join(', '),
      )
      .eq('id', detailId)
      .maybeSingle(),
    supabase
      .from('quote_items')
      .select('id, item_type, description, amount, created_at')
      .eq('work_order_id', detailId)
      .order('created_at', { ascending: true }),
    supabase
      .from('status_history')
      .select('id, status, changed_at, note')
      .eq('work_order_id', detailId)
      .order('changed_at', { ascending: true }),
  ]);

  if (workOrderError) {
    throwMappedSupabaseError(workOrderError);
  }

  if (!workOrder) {
    throw new NotFoundError('Work order not found.');
  }

  if (quoteItemsError) {
    throwMappedSupabaseError(quoteItemsError);
  }

  if (statusHistoryError) {
    throwMappedSupabaseError(statusHistoryError);
  }

  const typedWorkOrder = workOrder as unknown as ScanLookupWorkOrderRow;

  if (!typedWorkOrder.customers) {
    throw new InternalServerError();
  }

  const typedStatusHistory = (statusHistory ?? []) as StatusHistoryRow[];
  const pricing = calculateQuoteBreakdown((quoteItems ?? []) as QuoteItemRow[]);
  const receivedAt =
    typedStatusHistory.find((item) => item.status === 'RECEIVED')?.changed_at ??
    typedWorkOrder.created_at ??
    null;

  const currentStatus = typedWorkOrder.current_status as WorkOrderStatus;

  return {
    data: {
      availableActions: getAdminWorkOrderScanAvailableActions(currentStatus),
      availableStatusTransitions: getAdminWorkOrderScanAvailableStatusTransitions(currentStatus),
      board: {
        boardLengthClass: typedWorkOrder.board_length_class,
        brand: typedWorkOrder.board_brand,
        color: typedWorkOrder.board_color,
        damageDescription: typedWorkOrder.damage_description,
        serialLabel: typedWorkOrder.board_serial_label,
        sizeLabel: typedWorkOrder.board_size_label,
        type: typedWorkOrder.board_type,
      },
      customer: {
        name: typedWorkOrder.customers.name,
        phone: typedWorkOrder.customers.phone,
      },
      notes: {
        internalNote: typedWorkOrder.internal_note,
        pickupNote: typedWorkOrder.pickup_note,
        publicNote: typedWorkOrder.public_note,
      },
      pricing,
      recentHistory: mapScanRecentHistory(typedStatusHistory),
      summary: {
        daysInShop: calculateDaysInShop(typedWorkOrder.intake_date, now),
        estimatedCompletedAt: typedWorkOrder.estimated_completion_date,
        id: typedWorkOrder.id,
        isOverdue: Boolean(resolveData.is_overdue_estimated_completion),
        lastUpdatedAt: typedWorkOrder.updated_at,
        paperOrderNo: typedWorkOrder.paper_order_no,
        paymentReceived: typedWorkOrder.payment_received,
        receivedAt,
        status: currentStatus,
      },
    } satisfies AdminWorkOrderScanLookupData,
  };
};

export const appendAdminWorkOrderScanQuickNote = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  input: AdminWorkOrderScanQuickNoteInput,
) => {
  const { data: workOrder, error: workOrderError } = await supabase
    .from('work_orders')
    .select('id, internal_note, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (workOrderError) {
    throwMappedSupabaseError(workOrderError);
  }

  if (!workOrder) {
    throw new NotFoundError('Work order not found.');
  }

  const currentNote = workOrder.internal_note?.trim() ?? '';
  const nextNote = currentNote
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .includes(input.note)
    ? currentNote
    : currentNote
      ? `${currentNote}\n${input.note}`
      : input.note;

  const { data, error } = await supabase
    .from('work_orders')
    .update({ internal_note: nextNote })
    .eq('id', id)
    .select('id, internal_note, updated_at')
    .single();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    throw new InternalServerError();
  }

  return {
    data: {
      id: data.id,
      internalNote: data.internal_note,
      updatedAt: data.updated_at,
    },
  };
};

export const bulkAdminWorkOrderStatus = async (
  supabase: UserScopedSupabaseClient,
  input: BulkStatusInput,
  userId: string,
) => {
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select('id, paper_order_no')
    .in('paper_order_no', input.paperOrderNos);

  if (error) {
    throwMappedSupabaseError(error);
  }

  const workOrderMap = new Map(
    ((workOrders ?? []) as WorkOrderBulkLookupRow[]).map((workOrder) => [
      workOrder.paper_order_no,
      workOrder.id,
    ]),
  );
  const updated: Array<{
    currentStatus: Database['public']['Enums']['work_order_status'];
    paperOrderNo: string;
    statusHistoryId: string;
    workOrderId: string;
  }> = [];
  const skipped: Array<{
    paperOrderNo: string;
    reason: BulkStatusSkipReason;
  }> = [];

  for (const paperOrderNo of input.paperOrderNos) {
    const workOrderId = workOrderMap.get(paperOrderNo);

    if (!workOrderId) {
      skipped.push({
        paperOrderNo,
        reason: 'NOT_FOUND',
      });
      continue;
    }

    try {
      const result = await transitionAdminWorkOrderStatus(
        supabase,
        workOrderId,
        {
          hasInternalNote: false,
          note: input.note,
          status: input.status,
        },
        userId,
      );

      updated.push({
        currentStatus: result.data.workOrder.currentStatus,
        paperOrderNo,
        statusHistoryId: result.data.statusHistory.id,
        workOrderId,
      });
    } catch (transitionError) {
      if (transitionError instanceof NotFoundError) {
        skipped.push({
          paperOrderNo,
          reason: 'NOT_FOUND',
        });
        continue;
      }

      if (isInvalidStatusTransitionValidation(transitionError)) {
        skipped.push({
          paperOrderNo,
          reason: 'INVALID_STATUS_TRANSITION',
        });
        continue;
      }

      throw transitionError;
    }
  }

  return {
    data: {
      dedupedCount: input.paperOrderNos.length,
      requestedCount: input.requestedCount,
      skipped,
      skippedCount: skipped.length,
      updated,
      updatedCount: updated.length,
    },
  };
};

export const buildWorkOrderPatchUpdates = (
  patch: PatchWorkOrderInput,
  existingWorkOrder: Pick<
    WorkOrderRow,
    'payment_received' | 'payment_received_at' | 'repair_count' | 'repair_count_source'
  >,
  now = new Date(),
): Database['public']['Tables']['work_orders']['Update'] => {
  const updates: Database['public']['Tables']['work_orders']['Update'] = {};

  if (Object.prototype.hasOwnProperty.call(patch, 'estimatedCompletionDate')) {
    updates.estimated_completion_date = patch.estimatedCompletionDate;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'damageDescription')) {
    updates.damage_description = patch.damageDescription;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'publicNote')) {
    updates.public_note = patch.publicNote;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'internalNote')) {
    updates.internal_note = patch.internalNote;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'pickupNote')) {
    updates.pickup_note = patch.pickupNote;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'storageFeeWarningAfterDays')) {
    updates.storage_fee_warning_after_days = patch.storageFeeWarningAfterDays;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'paymentReceived')) {
    updates.payment_received = patch.paymentReceived;
    updates.payment_received_at = patch.paymentReceived
      ? existingWorkOrder.payment_received && existingWorkOrder.payment_received_at
        ? existingWorkOrder.payment_received_at
        : now.toISOString()
      : null;
  }

  const nextRepairCountSource = patch.repairCountSource ?? existingWorkOrder.repair_count_source;

  if (Object.prototype.hasOwnProperty.call(patch, 'repairCountSource')) {
    updates.repair_count_source = patch.repairCountSource;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'repairCount')) {
    updates.repair_count = patch.repairCount;
  }

  if (nextRepairCountSource === 'auto' && Object.prototype.hasOwnProperty.call(patch, 'repairMarks')) {
    updates.repair_count = patch.repairMarks && patch.repairMarks.length > 0 ? patch.repairMarks.length : null;
    updates.repair_count_source = 'auto';
  }

  return updates;
};

export const patchAdminWorkOrder = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  patch: PatchWorkOrderInput,
) => {
  const { data: existingWorkOrder, error: existingWorkOrderError } = await supabase
    .from('work_orders')
    .select('id, board_type, payment_received, payment_received_at, repair_count, repair_count_source')
    .eq('id', id)
    .maybeSingle();

  if (existingWorkOrderError) {
    throwMappedSupabaseError(existingWorkOrderError);
  }

  if (!existingWorkOrder) {
    throw new NotFoundError('Work order not found.');
  }

  if (patch.repairMarks) {
    for (const [index, mark] of patch.repairMarks.entries()) {
      const expectedTemplate = `${existingWorkOrder.board_type}:${mark.boardSide}:v1`;

      if (mark.templateKey !== expectedTemplate) {
        throw new ValidationError({
          [`repairMarks.${index}.templateKey`]: [`Must match ${expectedTemplate}.`],
        });
      }
    }
  }

  const updates = buildWorkOrderPatchUpdates(patch, existingWorkOrder);

  const { data, error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', id)
    .select('id, updated_at')
    .single();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    throw new InternalServerError();
  }

  if (patch.repairMarks) {
    await replaceRepairMarks(supabase, id, patch.repairMarks);
  }

  return {
    data: {
      id: data.id,
      updatedAt: data.updated_at,
    },
  };
};

export const transitionAdminWorkOrderStatus = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  input: StatusTransitionInput,
  userId: string,
) => {
  const rpcArgs: Database['public']['Functions']['transition_admin_work_order_status']['Args'] = {
    p_changed_by_user_id: userId,
    p_internal_note_is_set: input.hasInternalNote,
    p_status: input.status,
    p_work_order_id: id,
  };

  if (input.note) {
    rpcArgs.p_note = input.note;
  }

  if (input.hasInternalNote && input.internalNote) {
    rpcArgs.p_internal_note = input.internalNote;
  }

  const { data, error } = await supabase.rpc('transition_admin_work_order_status', rpcArgs);

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    data: mapStatusTransitionResult(data),
  };
};

export const getStaleReceivedDays = () => STALE_RECEIVED_DAYS;
