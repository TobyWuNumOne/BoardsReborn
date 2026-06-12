import { InternalServerError } from './api-errors';
import {
  emitPrintDeviceChangedBestEffort,
  emitPrintJobChangedBestEffort,
  getPrintDeviceRealtimeSnapshotByKey,
  getPrintJobRealtimeSnapshot,
} from './printing-realtime';
import { throwMappedSupabaseError } from './supabase-errors';
import type {
  ClaimPrintJobInput,
  CreatePrintJobInput,
  FailPrintJobInput,
  PrintJobListQuery,
} from './print-job-validation';
import type { ServiceRoleSupabaseClient, UserScopedSupabaseClient } from './supabase-clients';
import type { Database } from '../../types/database.types';

type AdminPrintJobListRow = Database['public']['Views']['admin_print_job_list']['Row'];

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PRINT_JOB_STALE_LOCK_SECONDS = 300;
const INITIAL_PRINT_JOB_TYPES = [
  'work_order_label',
  'customer_receipt',
] as const satisfies readonly Database['public']['Enums']['print_job_type'][];

const normalizePublicAppUrl = (value: string | undefined) => {
  const trimmedValue = value?.trim().replace(/\/+$/, '');

  return trimmedValue || 'http://localhost:3000';
};

const getPublicLookupUrl = () => {
  try {
    const config = useRuntimeConfig();
    return `${normalizePublicAppUrl(config.public.appUrl)}/repair-status`;
  } catch {
    return 'http://localhost:3000/repair-status';
  }
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

const assertRecord = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InternalServerError();
  }

  return value as Record<string, unknown>;
};

const parsePrintJobMutationResult = (value: unknown) => {
  const result = assertRecord(value);

  if (
    typeof result.id !== 'string' ||
    typeof result.workOrderId !== 'string' ||
    typeof result.jobType !== 'string' ||
    typeof result.status !== 'string' ||
    typeof result.attemptCount !== 'number' ||
    typeof result.maxAttempts !== 'number' ||
    (result.createdAt !== undefined && typeof result.createdAt !== 'string') ||
    typeof result.updatedAt !== 'string'
  ) {
    throw new InternalServerError();
  }

  return result as {
    attemptCount: number;
    createdAt?: string;
    id: string;
    jobType: Database['public']['Enums']['print_job_type'];
    maxAttempts: number;
    status: Database['public']['Enums']['print_job_status'];
    updatedAt: string;
    workOrderId: string;
  };
};

const parsePrintJobClaimResult = (value: unknown) => {
  const result = assertRecord(value);

  if (result.job === null) {
    return {
      job: null,
    };
  }

  const job = assertRecord(result.job);

  if (
    typeof job.id !== 'string' ||
    typeof job.workOrderId !== 'string' ||
    typeof job.jobType !== 'string' ||
    typeof job.attemptCount !== 'number' ||
    typeof job.maxAttempts !== 'number' ||
    typeof job.lockedAt !== 'string' ||
    typeof job.createdAt !== 'string'
  ) {
    throw new InternalServerError();
  }

  return {
    job: {
      attemptCount: job.attemptCount,
      createdAt: job.createdAt,
      id: job.id,
      jobType: job.jobType as Database['public']['Enums']['print_job_type'],
      lockedAt: job.lockedAt,
      maxAttempts: job.maxAttempts,
      payload: job.payload,
      workOrderId: job.workOrderId,
    },
  };
};

const parsePrintJobWorkerResult = (value: unknown) => {
  const result = assertRecord(value);

  if (
    typeof result.id !== 'string' ||
    typeof result.status !== 'string' ||
    typeof result.attemptCount !== 'number' ||
    typeof result.updatedAt !== 'string'
  ) {
    throw new InternalServerError();
  }

  return result as {
    attemptCount: number;
    id: string;
    lastError?: string | null;
    maxAttempts?: number;
    printedAt?: string | null;
    status: Database['public']['Enums']['print_job_status'];
    updatedAt: string;
  };
};

const mapPrintJobListRow = (row: AdminPrintJobListRow) => {
  if (
    !row.id ||
    !row.work_order_id ||
    !row.paper_order_no ||
    !row.job_type ||
    !row.status ||
    row.attempt_count === null ||
    row.max_attempts === null ||
    !row.created_at ||
    !row.updated_at
  ) {
    throw new InternalServerError();
  }

  return {
    attemptCount: row.attempt_count,
    board: {
      boardLengthClass: row.board_length_class,
      boardType: row.board_type,
    },
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
    },
    device: row.print_device_id
      ? {
          id: row.print_device_id,
          name: row.print_device_name,
        }
      : null,
    id: row.id,
    jobType: row.job_type,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    maxAttempts: row.max_attempts,
    printedAt: row.printed_at,
    status: row.status,
    updatedAt: row.updated_at,
    workOrder: {
      id: row.work_order_id,
      paperOrderNo: row.paper_order_no,
    },
  };
};

export const listAdminPrintJobs = async (
  supabase: UserScopedSupabaseClient,
  query: PrintJobListQuery,
) => {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;
  let request = supabase.from('admin_print_job_list').select('*', { count: 'exact' });

  if (query.filters.status) {
    request = request.eq('status', query.filters.status);
  }

  if (query.filters.workOrderId) {
    request = request.eq('work_order_id', query.filters.workOrderId);
  }

  if (query.filters.paperOrderNo) {
    request = request.ilike('paper_order_no', `%${query.filters.paperOrderNo}%`);
  }

  const { data, count, error } = await request
    .order(query.sort.field, { ascending: query.sort.direction === 'asc' })
    .range(from, to);

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    data: (data ?? []).map((row) => mapPrintJobListRow(row as AdminPrintJobListRow)),
    pageInfo: calculatePageInfo(query.page, query.pageSize, count ?? 0),
  };
};

export const createAdminPrintJob = async (
  supabase: UserScopedSupabaseClient,
  input: CreatePrintJobInput,
  userId: string,
) => {
  const { data, error } = await supabase.rpc('create_admin_print_job', {
    p_created_by_user_id: userId,
    p_job_type: input.jobType,
    p_public_lookup_url: getPublicLookupUrl(),
    p_work_order_id: input.workOrderId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parsePrintJobMutationResult(data);
  await emitPrintJobChangedBestEffort(supabase, {
    changedAt: result.updatedAt,
    entityId: result.id,
    jobStatus: result.status,
    operation: 'INSERT',
    wakeupReason: result.status === 'pending' ? 'enqueued' : undefined,
    workOrderId: result.workOrderId,
  });

  return {
    data: result,
  };
};

export const retryAdminPrintJob = async (
  supabase: UserScopedSupabaseClient,
  id: string,
  userId: string,
) => {
  const { data, error } = await supabase.rpc('retry_admin_print_job', {
    p_print_job_id: id,
    p_requested_by_user_id: userId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parsePrintJobMutationResult(data);
  await emitPrintJobChangedBestEffort(supabase, {
    changedAt: result.updatedAt,
    entityId: result.id,
    jobStatus: result.status,
    operation: 'UPDATE',
    wakeupReason: result.status === 'pending' ? 'retried' : undefined,
    workOrderId: result.workOrderId,
  });

  return {
    data: result,
  };
};

export const enqueueInitialPrintJobForWorkOrder = async (
  supabase: UserScopedSupabaseClient,
  workOrderId: string,
  userId: string,
) => {
  for (const jobType of INITIAL_PRINT_JOB_TYPES) {
    try {
      await createAdminPrintJob(
        supabase,
        {
          jobType,
          workOrderId,
        },
        userId,
      );
    } catch (error) {
      console.error('Failed to enqueue initial print job', {
        error,
        jobType,
        workOrderId,
      });
    }
  }
};

export const claimPrintJob = async (
  supabase: ServiceRoleSupabaseClient,
  input: ClaimPrintJobInput,
) => {
  const { data, error } = await supabase.rpc('claim_next_print_job', {
    p_device_key: input.deviceKey,
    p_stale_lock_seconds: PRINT_JOB_STALE_LOCK_SECONDS,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parsePrintJobClaimResult(data);

  try {
    const deviceSnapshot = await getPrintDeviceRealtimeSnapshotByKey(supabase, input.deviceKey);

    if (result.job) {
      const jobSnapshot = await getPrintJobRealtimeSnapshot(supabase, result.job.id);

      if (jobSnapshot) {
        await emitPrintJobChangedBestEffort(supabase, {
          changedAt: jobSnapshot.changedAt,
          entityId: jobSnapshot.entityId,
          jobStatus: jobSnapshot.jobStatus,
          operation: 'UPDATE',
          workOrderId: jobSnapshot.workOrderId,
        });
      }
    }

    if (deviceSnapshot) {
      await emitPrintDeviceChangedBestEffort(supabase, {
        changedAt: deviceSnapshot.changedAt,
        deviceKey: deviceSnapshot.deviceKey,
        entityId: deviceSnapshot.entityId,
        operation: 'UPDATE',
      });
    }
  } catch (realtimeError) {
    console.error('Failed to emit realtime events after claimPrintJob', {
      deviceKey: input.deviceKey,
      error: realtimeError,
      jobId: result.job?.id ?? null,
    });
  }

  return {
    data: result,
  };
};

export const markPrintJobSucceeded = async (
  supabase: ServiceRoleSupabaseClient,
  id: string,
  deviceKey: string,
) => {
  const { data, error } = await supabase.rpc('mark_print_job_succeeded', {
    p_device_key: deviceKey,
    p_print_job_id: id,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parsePrintJobWorkerResult(data);

  try {
    const [jobSnapshot, deviceSnapshot] = await Promise.all([
      getPrintJobRealtimeSnapshot(supabase, id),
      getPrintDeviceRealtimeSnapshotByKey(supabase, deviceKey),
    ]);

    if (jobSnapshot) {
      await emitPrintJobChangedBestEffort(supabase, {
        changedAt: jobSnapshot.changedAt,
        entityId: jobSnapshot.entityId,
        jobStatus: jobSnapshot.jobStatus,
        operation: 'UPDATE',
        workOrderId: jobSnapshot.workOrderId,
      });
    }

    if (deviceSnapshot) {
      await emitPrintDeviceChangedBestEffort(supabase, {
        changedAt: deviceSnapshot.changedAt,
        deviceKey: deviceSnapshot.deviceKey,
        entityId: deviceSnapshot.entityId,
        operation: 'UPDATE',
      });
    }
  } catch (realtimeError) {
    console.error('Failed to emit realtime events after markPrintJobSucceeded', {
      deviceKey,
      error: realtimeError,
      jobId: id,
    });
  }

  return {
    data: result,
  };
};

export const markPrintJobFailed = async (
  supabase: ServiceRoleSupabaseClient,
  id: string,
  input: FailPrintJobInput,
) => {
  const { data, error } = await supabase.rpc('mark_print_job_failed', {
    p_device_key: input.deviceKey,
    p_error: input.error,
    p_print_job_id: id,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parsePrintJobWorkerResult(data);

  try {
    const [jobSnapshot, deviceSnapshot] = await Promise.all([
      getPrintJobRealtimeSnapshot(supabase, id),
      getPrintDeviceRealtimeSnapshotByKey(supabase, input.deviceKey),
    ]);

    if (jobSnapshot) {
      await emitPrintJobChangedBestEffort(supabase, {
        changedAt: jobSnapshot.changedAt,
        entityId: jobSnapshot.entityId,
        jobStatus: jobSnapshot.jobStatus,
        operation: 'UPDATE',
        wakeupReason: jobSnapshot.jobStatus === 'pending' ? 'retried' : undefined,
        workOrderId: jobSnapshot.workOrderId,
      });
    }

    if (deviceSnapshot) {
      await emitPrintDeviceChangedBestEffort(supabase, {
        changedAt: deviceSnapshot.changedAt,
        deviceKey: deviceSnapshot.deviceKey,
        entityId: deviceSnapshot.entityId,
        operation: 'UPDATE',
      });
    }
  } catch (realtimeError) {
    console.error('Failed to emit realtime events after markPrintJobFailed', {
      deviceKey: input.deviceKey,
      error: realtimeError,
      jobId: id,
    });
  }

  return {
    data: result,
  };
};
