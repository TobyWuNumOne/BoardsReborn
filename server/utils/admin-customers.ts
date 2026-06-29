import type { Database } from '../../types/database.types';
import { ConflictError, InternalServerError, NotFoundError, ValidationError } from './api-errors';
import { deriveLineNotificationStatus } from './admin-line-bindings';
import { type UserScopedSupabaseClient } from './supabase-clients';
import { throwMappedSupabaseError, type SupabaseLikeError } from './supabase-errors';
import type {
  AdminCustomerDetailQuery,
  AdminCustomerListQuery,
  AdminCustomerUpdateBody,
} from './work-order-validation';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerLineAccountRow = Pick<
  Database['public']['Tables']['customer_line_accounts']['Row'],
  | 'blocked_at'
  | 'display_name'
  | 'friendship_checked_at'
  | 'is_friend'
  | 'last_seen_at'
  | 'linked_at'
>;
type AdminCustomerWorkOrderRow = Pick<
  Database['public']['Views']['admin_work_order_list']['Row'],
  | 'board_color'
  | 'board_length_class'
  | 'board_type'
  | 'current_status'
  | 'id'
  | 'intake_date'
  | 'paper_order_no'
  | 'repair_count'
  | 'updated_at'
>;
type AdminCustomerListRow = Pick<
  Database['public']['Views']['admin_customer_list']['Row'],
  | 'active_work_order_count'
  | 'created_at'
  | 'id'
  | 'latest_paper_order_no'
  | 'latest_work_order_id'
  | 'latest_work_order_status'
  | 'latest_work_order_updated_at'
  | 'line_blocked_at'
  | 'line_display_name'
  | 'line_friendship_checked_at'
  | 'line_is_friend'
  | 'line_linked'
  | 'line_notify_status'
  | 'name'
  | 'note'
  | 'phone'
  | 'updated_at'
  | 'work_order_count'
>;

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TransferAdminWorkOrderCustomerRow {
  previous_customer_id: string | null;
  target_customer_id: string | null;
  transferred_at: string | null;
  work_order_id: string | null;
}

const ADMIN_CUSTOMER_LIST_SORT_COLUMN_MAP = {
  activeWorkOrderCount: 'active_work_order_count',
  createdAt: 'created_at',
  name: 'name',
  phone: 'phone',
  updatedAt: 'updated_at',
  workOrderCount: 'work_order_count',
} as const;

const ADMIN_CUSTOMER_LIST_SELECT = [
  'id',
  'name',
  'phone',
  'note',
  'created_at',
  'updated_at',
  'work_order_count',
  'active_work_order_count',
  'latest_work_order_id',
  'latest_paper_order_no',
  'latest_work_order_status',
  'latest_work_order_updated_at',
  'line_linked',
  'line_display_name',
  'line_is_friend',
  'line_blocked_at',
  'line_friendship_checked_at',
  'line_notify_status',
].join(', ');

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

const mapCustomerProfile = (row: Pick<CustomerRow, 'created_at' | 'id' | 'name' | 'note' | 'phone' | 'updated_at'>) => ({
  createdAt: row.created_at,
  id: row.id,
  name: row.name,
  note: row.note,
  phone: row.phone,
  updatedAt: row.updated_at,
});

const mapCustomerLineSummary = (
  input:
    | {
        binding: CustomerLineAccountRow;
        linkedAt: string | null;
      }
    | {
        binding: null;
        linkedAt?: null;
      },
) => {
  if (!input.binding) {
    return {
      blockedAt: null,
      displayName: null,
      friendshipCheckedAt: null,
      isFriend: null,
      linkedAt: null,
      notificationStatus: 'not_notifyable' as const,
      status: 'unbound' as const,
    };
  }

  return {
    blockedAt: input.binding.blocked_at,
    displayName: input.binding.display_name,
    friendshipCheckedAt: input.binding.friendship_checked_at ?? input.binding.last_seen_at,
    isFriend: input.binding.is_friend,
    linkedAt: input.linkedAt,
    notificationStatus: deriveLineNotificationStatus(input.binding),
    status: 'bound' as const,
  };
};

const mapCustomerListLineSummary = (row: AdminCustomerListRow) => {
  if (!row.line_linked) {
    return mapCustomerLineSummary({ binding: null });
  }

  return {
    blockedAt: row.line_blocked_at,
    displayName: row.line_display_name,
    friendshipCheckedAt: row.line_friendship_checked_at,
    isFriend: row.line_is_friend,
    linkedAt: null,
    notificationStatus:
      row.line_notify_status === 'notifyable' || row.line_notify_status === 'not_notifyable'
        ? row.line_notify_status
        : 'unknown',
    status: 'bound' as const,
  };
};

const mapCustomerWorkOrderSummary = (row: AdminCustomerWorkOrderRow) => {
  if (
    !row.id ||
    !row.paper_order_no ||
    !row.current_status ||
    !row.board_type ||
    !row.intake_date ||
    !row.updated_at
  ) {
    throw new InternalServerError();
  }

  return {
    boardColor: row.board_color,
    boardLengthClass: row.board_length_class,
    boardType: row.board_type,
    currentStatus: row.current_status,
    id: row.id,
    intakeDate: row.intake_date,
    paperOrderNo: row.paper_order_no,
    repairCount: row.repair_count,
    updatedAt: row.updated_at,
  };
};

const mapCustomerListRow = (row: AdminCustomerListRow) => {
  if (!row.id || !row.name || !row.phone || !row.created_at || !row.updated_at) {
    throw new InternalServerError();
  }

  return {
    activeWorkOrderCount: row.active_work_order_count ?? 0,
    createdAt: row.created_at,
    id: row.id,
    latestWorkOrder: row.latest_work_order_id
      ? {
          currentStatus: row.latest_work_order_status,
          id: row.latest_work_order_id,
          paperOrderNo: row.latest_paper_order_no,
          updatedAt: row.latest_work_order_updated_at,
        }
      : null,
    line: mapCustomerListLineSummary(row),
    name: row.name,
    note: row.note,
    phone: row.phone,
    updatedAt: row.updated_at,
    workOrderCount: row.work_order_count ?? 0,
  };
};

const getListSortConfig = (sort: string) => {
  const [field, direction] = sort.split(':') as [
    keyof typeof ADMIN_CUSTOMER_LIST_SORT_COLUMN_MAP,
    'asc' | 'desc',
  ];

  return {
    ascending: direction === 'asc',
    column: ADMIN_CUSTOMER_LIST_SORT_COLUMN_MAP[field] ?? 'updated_at',
  };
};

const escapePostgrestLikePattern = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const throwMappedTransferRpcError = (error: SupabaseLikeError): never => {
  const details = [error.message, error.details, error.hint].filter(Boolean).join(' ');

  if (error.code === '23514' && details.includes('Target customer must be different')) {
    throw new ValidationError({
      targetCustomerId: ['Must be different from the current customer.'],
    });
  }

  if (error.code === '23503' && details.includes('Work order has LINE bind tokens')) {
    throw new ConflictError('Cannot transfer a work order with LINE bind tokens.');
  }

  if (error.code === '23503' && details.includes('Work order has LINE jobs')) {
    throw new ConflictError('Cannot transfer a work order with LINE jobs.');
  }

  throwMappedSupabaseError(error);
};

export const listAdminCustomers = async (
  supabase: UserScopedSupabaseClient,
  query: AdminCustomerListQuery,
) => {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const sort = getListSortConfig(query.sort);
  let request = supabase.from('admin_customer_list').select(ADMIN_CUSTOMER_LIST_SELECT, {
    count: 'exact',
  });

  if (query.q) {
    const escapedQuery = escapePostgrestLikePattern(query.q);
    request = request.ilike('search_text', `%${escapedQuery}%`);
  }

  if (query.lineStatus === 'linked') {
    request = request.eq('line_linked', true);
  }

  if (query.lineStatus === 'unlinked') {
    request = request.eq('line_linked', false);
  }

  if (query.lineStatus === 'not_notifyable') {
    request = request.eq('line_notify_status', 'not_notifyable');
  }

  const { count, data, error } = await request
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    data: ((data ?? []) as AdminCustomerListRow[]).map((row) => mapCustomerListRow(row)),
    pageInfo: calculatePageInfo(query.page, query.pageSize, count ?? 0),
  };
};

export const getAdminCustomerDetail = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  query: AdminCustomerDetailQuery,
) => {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone, note, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (customerError) {
    throwMappedSupabaseError(customerError);
  }

  if (!customer) {
    throw new NotFoundError('Customer not found.');
  }

  const [lineResult, workOrdersResult] = await Promise.all([
    supabase
      .from('customer_line_accounts')
      .select('display_name, linked_at, last_seen_at, friendship_checked_at, is_friend, blocked_at')
      .eq('customer_id', id)
      .maybeSingle(),
    supabase
      .from('admin_work_order_list')
      .select(
        'id, paper_order_no, current_status, board_type, board_length_class, board_color, repair_count, intake_date, updated_at',
        { count: 'exact' },
      )
      .eq('customer_id', id)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to),
  ]);

  if (lineResult.error) {
    throwMappedSupabaseError(lineResult.error);
  }

  if (workOrdersResult.error) {
    throwMappedSupabaseError(workOrdersResult.error);
  }

  return {
    data: {
      customer: mapCustomerProfile(customer),
      line: mapCustomerLineSummary(
        lineResult.data
          ? {
              binding: lineResult.data as CustomerLineAccountRow,
              linkedAt: lineResult.data.linked_at,
            }
          : { binding: null },
      ),
      workOrders: {
        data: ((workOrdersResult.data ?? []) as AdminCustomerWorkOrderRow[]).map((row) =>
          mapCustomerWorkOrderSummary(row),
        ),
        pageInfo: calculatePageInfo(query.page, query.pageSize, workOrdersResult.count ?? 0),
      },
    },
  };
};

export const updateAdminCustomer = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  body: AdminCustomerUpdateBody,
) => {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: body.name,
      note: body.note,
      phone: body.phone,
    })
    .eq('id', id)
    .select('id, name, phone, note, created_at, updated_at')
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    throw new NotFoundError('Customer not found.');
  }

  return {
    data: mapCustomerProfile(data),
  };
};

export const transferAdminWorkOrderCustomer = async (
  supabase: UserScopedSupabaseClient,
  workOrderId: string,
  targetCustomerId: string,
) => {
  const { data, error } = await (supabase.rpc as never)('transfer_admin_work_order_customer', {
    p_target_customer_id: targetCustomerId,
    p_work_order_id: workOrderId,
  });

  if (error) {
    throwMappedTransferRpcError(error);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new InternalServerError();
  }

  const typedRow = row as TransferAdminWorkOrderCustomerRow;

  if (
    !typedRow.work_order_id ||
    !typedRow.previous_customer_id ||
    !typedRow.target_customer_id ||
    !typedRow.transferred_at
  ) {
    throw new InternalServerError();
  }

  return {
    data: {
      previousCustomerId: typedRow.previous_customer_id,
      targetCustomerId: typedRow.target_customer_id,
      transferredAt: typedRow.transferred_at,
      workOrderId: typedRow.work_order_id,
    },
  };
};
