import type { UserScopedSupabaseClient } from './supabase-clients';

export type WorkOrderReceivedLineNotification =
  | { enqueued: true; jobId: string }
  | {
      enqueued: false;
      reason: 'ENQUEUE_FAILED' | 'JOB_ALREADY_EXISTS' | 'NO_ACTIVE_LINE_BINDING';
    };

const parseResult = (value: unknown): WorkOrderReceivedLineNotification | null => {
  if (typeof value !== 'object' || value === null) return null;

  if (
    'enqueued' in value &&
    value.enqueued === true &&
    'jobId' in value &&
    typeof value.jobId === 'string'
  ) {
    return { enqueued: true, jobId: value.jobId };
  }

  if (
    'enqueued' in value &&
    value.enqueued === false &&
    'reason' in value &&
    (value.reason === 'NO_ACTIVE_LINE_BINDING' || value.reason === 'JOB_ALREADY_EXISTS')
  ) {
    return { enqueued: false, reason: value.reason };
  }

  return null;
};

export const enqueueWorkOrderReceivedLineNotification = async (
  supabase: UserScopedSupabaseClient,
  workOrderId: string,
): Promise<WorkOrderReceivedLineNotification> => {
  const { data, error } = await supabase.rpc('enqueue_work_order_received_line_job', {
    p_work_order_id: workOrderId,
  });

  if (error) return { enqueued: false, reason: 'ENQUEUE_FAILED' };

  return parseResult(data) ?? { enqueued: false, reason: 'ENQUEUE_FAILED' };
};
