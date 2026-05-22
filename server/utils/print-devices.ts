import { ConflictError, InternalServerError, NotFoundError } from './api-errors';
import { throwMappedSupabaseError } from './supabase-errors';
import type {
  CreatePrintDeviceInput,
  PrintDeviceListQuery,
  UpdatePrintDeviceInput,
} from './print-job-validation';
import type { UserScopedSupabaseClient } from './supabase-clients';
import type { Database } from '../../types/database.types';

type AdminPrintDeviceListRow = Database['public']['Views']['admin_print_device_list']['Row'];

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

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

const mapPrintDeviceListRow = (row: AdminPrintDeviceListRow) => {
  if (
    !row.id ||
    !row.name ||
    !row.device_key ||
    !row.status ||
    !row.created_at ||
    !row.updated_at
  ) {
    throw new InternalServerError();
  }

  return {
    createdAt: row.created_at,
    currentJob: row.current_job_id
      ? {
          id: row.current_job_id,
          lockedAt: row.current_job_locked_at,
          paperOrderNo: row.current_job_paper_order_no,
          status: row.current_job_status,
          workOrderId: row.current_job_work_order_id,
        }
      : null,
    deviceKey: row.device_key,
    id: row.id,
    lastSeenAt: row.last_seen_at,
    location: row.location,
    name: row.name,
    recentError: row.recent_error_message
      ? {
          jobId: row.recent_error_job_id,
          message: row.recent_error_message,
          updatedAt: row.recent_error_updated_at,
        }
      : null,
    status: row.status,
    updatedAt: row.updated_at,
  };
};

const getPrintDeviceById = async (supabase: UserScopedSupabaseClient, id: string) => {
  const { data, error } = await supabase
    .from('admin_print_device_list')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    throw new NotFoundError('Print device not found.');
  }

  return mapPrintDeviceListRow(data as AdminPrintDeviceListRow);
};

export const listAdminPrintDevices = async (
  supabase: UserScopedSupabaseClient,
  query: PrintDeviceListQuery,
) => {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  let request = supabase.from('admin_print_device_list').select('*', { count: 'exact' });

  if (query.filters.status) {
    request = request.eq('status', query.filters.status);
  }

  if (query.filters.q) {
    request = request.ilike('search_text', `%${query.filters.q}%`);
  }

  const { data, count, error } = await request
    .order(query.sort.field, { ascending: query.sort.direction === 'asc', nullsFirst: false })
    .order('name', { ascending: true })
    .range(from, to);

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    data: (data ?? []).map((row) => mapPrintDeviceListRow(row as AdminPrintDeviceListRow)),
    pageInfo: calculatePageInfo(query.page, query.pageSize, count ?? 0),
  };
};

export const updateAdminPrintDevice = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  input: UpdatePrintDeviceInput,
) => {
  const { data, error } = await supabase
    .from('print_devices')
    .update({
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data?.id) {
    throw new NotFoundError('Print device not found.');
  }

  return {
    data: await getPrintDeviceById(supabase, id),
  };
};

export const createAdminPrintDevice = async (
  supabase: UserScopedSupabaseClient,
  input: CreatePrintDeviceInput,
) => {
  const { data, error } = await supabase
    .from('print_devices')
    .insert({
      device_key: input.deviceKey,
      location: input.location ?? null,
      name: input.name,
      status: input.status,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data?.id) {
    throw new InternalServerError('Unable to create print device.');
  }

  return {
    data: await getPrintDeviceById(supabase, data.id),
  };
};

export const deleteAdminPrintDevice = async (
  supabase: UserScopedSupabaseClient,
  id: string,
) => {
  const { count, error: activeJobCheckError } = await supabase
    .from('print_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('print_device_id', id)
    .in('status', ['locked', 'printing']);

  if (activeJobCheckError) {
    throwMappedSupabaseError(activeJobCheckError);
  }

  if ((count ?? 0) > 0) {
    throw new ConflictError('Cannot delete a print device with active print jobs.');
  }

  const { data, error } = await supabase
    .from('print_devices')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data?.id) {
    throw new NotFoundError('Print device not found.');
  }

  return {
    data: {
      id: data.id,
    },
  };
};
