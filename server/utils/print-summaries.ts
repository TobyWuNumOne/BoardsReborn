import { InternalServerError } from './api-errors';
import type { PrintSummaryQuery } from './print-job-validation';
import { throwMappedSupabaseError } from './supabase-errors';
import type { UserScopedSupabaseClient } from './supabase-clients';
import type { Database } from '../../types/database.types';

type AdminPrintJobListRow = Database['public']['Views']['admin_print_job_list']['Row'];
type PrintJobStatus = Database['public']['Enums']['print_job_status'];

const REPRINT_ALLOWED_STATUSES = new Set<PrintJobStatus>(['printed', 'failed', 'cancelled']);
const ACTIVE_PRINT_JOB_STATUSES = new Set<PrintJobStatus>(['pending', 'locked', 'printing']);

const createEmptyPrintSummary = (workOrderId: string) => ({
  hasActiveJob: false,
  hasFailedJob: false,
  hasPendingJob: false,
  latestJob: null as
    | {
        attemptCount: number;
        createdAt: string;
        id: string;
        lastError: string | null;
        maxAttempts: number;
        printedAt: string | null;
        status: PrintJobStatus;
        updatedAt: string;
      }
    | null,
  reprintAllowed: true,
  workOrderId,
});

const assertSummaryRow = (row: AdminPrintJobListRow) => {
  if (
    !row.id ||
    !row.work_order_id ||
    !row.status ||
    row.attempt_count === null ||
    row.max_attempts === null ||
    !row.created_at ||
    !row.updated_at
  ) {
    throw new InternalServerError();
  }

  return row as AdminPrintJobListRow & {
    attempt_count: number;
    created_at: string;
    id: string;
    max_attempts: number;
    status: PrintJobStatus;
    updated_at: string;
    work_order_id: string;
  };
};

export const listAdminPrintSummaries = async (
  supabase: UserScopedSupabaseClient,
  query: PrintSummaryQuery,
) => {
  const summaries = new Map(
    query.workOrderIds.map((workOrderId) => [workOrderId, createEmptyPrintSummary(workOrderId)]),
  );

  const { data, error } = await supabase
    .from('admin_print_job_list')
    .select(
      'id, work_order_id, status, attempt_count, max_attempts, last_error, printed_at, created_at, updated_at',
    )
    .in('work_order_id', query.workOrderIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    throwMappedSupabaseError(error);
  }

  for (const rawRow of data ?? []) {
    const row = assertSummaryRow(rawRow as AdminPrintJobListRow);
    const summary = summaries.get(row.work_order_id);

    if (!summary) {
      continue;
    }

    if (!summary.latestJob) {
      summary.latestJob = {
        attemptCount: row.attempt_count,
        createdAt: row.created_at,
        id: row.id,
        lastError: row.last_error,
        maxAttempts: row.max_attempts,
        printedAt: row.printed_at,
        status: row.status,
        updatedAt: row.updated_at,
      };
      summary.reprintAllowed = REPRINT_ALLOWED_STATUSES.has(row.status);
    }

    if (row.status === 'pending') {
      summary.hasPendingJob = true;
    }

    if (ACTIVE_PRINT_JOB_STATUSES.has(row.status)) {
      summary.hasActiveJob = true;
    }

    if (row.status === 'failed') {
      summary.hasFailedJob = true;
    }
  }

  return {
    data: Object.fromEntries(query.workOrderIds.map((id) => [id, summaries.get(id)])),
  };
};
