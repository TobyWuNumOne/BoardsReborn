import { InternalServerError, NotFoundError, ValidationError } from './api-errors';
import { throwMappedSupabaseError } from './supabase-errors';
import {
  type BulkStatusInput,
  STALE_RECEIVED_DAYS,
  type CreateWorkOrderInput,
  type PatchWorkOrderInput,
  type StatusTransitionInput,
  type WorkOrderListQuery,
} from './work-order-validation';
import type { UserScopedSupabaseClient } from './supabase-clients';
import type { Database, Json } from '../../types/database.types';

type AdminWorkOrderListRow = Database['public']['Views']['admin_work_order_list']['Row'];
type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type WorkOrderBulkLookupRow = Pick<WorkOrderRow, 'id' | 'paper_order_no'>;
type QuoteItemRow = Pick<
  Database['public']['Tables']['quote_items']['Row'],
  'amount' | 'created_at' | 'description' | 'id' | 'item_type'
>;
type StatusHistoryRow = Pick<
  Database['public']['Tables']['status_history']['Row'],
  'changed_at' | 'id' | 'note' | 'status'
>;

type WorkOrderWithCustomer = WorkOrderRow & {
  customers: Pick<CustomerRow, 'id' | 'name' | 'phone'> | null;
};
type WorkOrderResolveRow = Pick<
  WorkOrderRow,
  'board_size_label' | 'board_type' | 'current_status' | 'id' | 'paper_order_no' | 'updated_at'
> & {
  customers: Pick<CustomerRow, 'id' | 'name'> | null;
};

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type BulkStatusSkipReason = 'INVALID_STATUS_TRANSITION' | 'NOT_FOUND';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toJsonObject = (value: unknown): Json => value as Json;

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
  paymentReceived: row.payment_received,
  paymentReceivedAt: row.payment_received_at,
  quoteTotalAmount: row.quote_total_amount,
  readyForPickupAt: row.ready_for_pickup_at,
});

export const mapWorkOrderResolveRow = (row: WorkOrderResolveRow) => {
  if (!row.customers) {
    throw new InternalServerError();
  }

  return {
    board: {
      boardType: row.board_type,
      sizeLabel: row.board_size_label,
    },
    currentStatus: row.current_status,
    customer: {
      id: row.customers.id,
      name: row.customers.name,
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

const mapWorkOrderDetail = (
  workOrder: WorkOrderWithCustomer,
  quoteItems: QuoteItemRow[],
  statusHistory: StatusHistoryRow[],
) => {
  if (!workOrder.customers) {
    throw new InternalServerError();
  }

  return {
    board: {
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

export const resolveAdminWorkOrderByPaperOrderNo = async (
  supabase: UserScopedSupabaseClient,
  paperOrderNo: string,
) => {
  const { data, error } = await supabase
    .from('work_orders')
    .select(
      [
        'id',
        'paper_order_no',
        'current_status',
        'board_type',
        'board_size_label',
        'updated_at',
        'customers:customer_id(id, name)',
      ].join(', '),
    )
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

export const createAdminWorkOrder = async (
  supabase: UserScopedSupabaseClient,
  input: CreateWorkOrderInput,
  userId: string,
) => {
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

  return {
    data: assertCreateResult(data),
  };
};

export const getAdminWorkOrderDetail = async (supabase: UserScopedSupabaseClient, id: string) => {
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
          'customer_id',
          'board_type',
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

  return {
    data: mapWorkOrderDetail(
      workOrder as unknown as WorkOrderWithCustomer,
      (quoteItems ?? []) as QuoteItemRow[],
      (statusHistory ?? []) as StatusHistoryRow[],
    ),
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
  existingWorkOrder: Pick<WorkOrderRow, 'payment_received' | 'payment_received_at'>,
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

  return updates;
};

export const patchAdminWorkOrder = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  patch: PatchWorkOrderInput,
) => {
  const { data: existingWorkOrder, error: existingWorkOrderError } = await supabase
    .from('work_orders')
    .select('id, payment_received, payment_received_at')
    .eq('id', id)
    .maybeSingle();

  if (existingWorkOrderError) {
    throwMappedSupabaseError(existingWorkOrderError);
  }

  if (!existingWorkOrder) {
    throw new NotFoundError('Work order not found.');
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
