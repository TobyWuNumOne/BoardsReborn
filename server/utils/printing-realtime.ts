import type { Database } from '../../types/database.types';
import type { ServiceRoleSupabaseClient, UserScopedSupabaseClient } from './supabase-clients';

type Json = Database['public']['Functions']['create_admin_work_order']['Args']['p_board'];
type RealtimeOperation = 'DELETE' | 'INSERT' | 'UPDATE';
type PrintJobStatus = Database['public']['Enums']['print_job_status'];
type PrintingRealtimeClient = Pick<UserScopedSupabaseClient, 'from' | 'rpc'> &
  Pick<ServiceRoleSupabaseClient, 'from' | 'rpc'>;
type WorkerWakeupReason = 'enqueued' | 'retried';

interface PrintDeviceRealtimeSnapshot {
  changedAt: string;
  deviceKey: string;
  entityId: string;
}

interface PrintJobRealtimeSnapshot {
  changedAt: string;
  entityId: string;
  jobStatus: PrintJobStatus;
  workOrderId: string;
}

interface EmitPrintingRealtimeEventInput {
  event: string;
  isPrivate?: boolean;
  payload: Json;
  topic: string;
}

const PRINTING_REALTIME_EVENT_TYPES = {
  deviceChanged: 'print_device.changed',
  jobAvailable: 'printing.job_available',
  jobChanged: 'print_job.changed',
  summaryChanged: 'printing.summary.changed',
} as const;

const emitPrintingRealtimeEvent = async (
  supabase: PrintingRealtimeClient,
  { event, isPrivate = true, payload, topic }: EmitPrintingRealtimeEventInput,
) => {
  const { error } = await supabase.rpc('emit_printing_realtime_event', {
    p_event: event,
    p_is_private: isPrivate,
    p_payload: payload,
    p_topic: topic,
  });

  if (error) {
    throw error;
  }
};

const buildSummaryPayload = ({
  changedAt,
  entityId,
  operation,
  source,
  workOrderId,
}: {
  changedAt: string;
  entityId: string;
  operation: RealtimeOperation;
  source: 'print_devices' | 'print_jobs';
  workOrderId?: string;
}) => ({
  changedAt,
  entityId,
  eventType: PRINTING_REALTIME_EVENT_TYPES.summaryChanged,
  operation,
  ...(workOrderId ? { workOrderId } : {}),
  source,
});

const emitPrintSummaryChanged = async (
  supabase: PrintingRealtimeClient,
  input: {
    changedAt: string;
    entityId: string;
    operation: RealtimeOperation;
    source: 'print_devices' | 'print_jobs';
    workOrderId?: string;
  },
) =>
  emitPrintingRealtimeEvent(supabase, {
    event: PRINTING_REALTIME_EVENT_TYPES.summaryChanged,
    payload: buildSummaryPayload(input),
    topic: 'printing:summary',
  });

const resolveChangedAt = (createdAt: string | null | undefined, updatedAt: string | null | undefined) =>
  updatedAt ?? createdAt ?? new Date().toISOString();

export const emitPrintJobChangedBestEffort = async (
  supabase: PrintingRealtimeClient,
  input: {
    changedAt: string;
    entityId: string;
    jobStatus: PrintJobStatus;
    operation: RealtimeOperation;
    wakeupReason?: WorkerWakeupReason;
    workOrderId: string;
  },
) => {
  try {
    const payload = {
      changedAt: input.changedAt,
      entityId: input.entityId,
      eventType: PRINTING_REALTIME_EVENT_TYPES.jobChanged,
      jobStatus: input.jobStatus,
      operation: input.operation,
      source: 'print_jobs' as const,
      workOrderId: input.workOrderId,
    };

    if (input.wakeupReason) {
      await emitPrintingRealtimeEvent(supabase, {
        event: PRINTING_REALTIME_EVENT_TYPES.jobAvailable,
        isPrivate: false,
        payload: {
          changedAt: input.changedAt,
          eventType: PRINTING_REALTIME_EVENT_TYPES.jobAvailable,
          reason: input.wakeupReason,
        },
        topic: 'printing:worker-wakeup',
      });
    }

    await Promise.all([
      emitPrintingRealtimeEvent(supabase, {
        event: PRINTING_REALTIME_EVENT_TYPES.jobChanged,
        payload,
        topic: 'printing:jobs',
      }),
      emitPrintSummaryChanged(supabase, {
        changedAt: input.changedAt,
        entityId: input.entityId,
        operation: input.operation,
        source: 'print_jobs',
        workOrderId: input.workOrderId,
      }),
    ]);
  } catch (error) {
    console.error('Failed to emit print job realtime event', {
      error,
      jobId: input.entityId,
      jobStatus: input.jobStatus,
      operation: input.operation,
      wakeupReason: input.wakeupReason ?? null,
      workOrderId: input.workOrderId,
    });
  }
};

export const emitPrintDeviceChangedBestEffort = async (
  supabase: PrintingRealtimeClient,
  input: {
    changedAt: string;
    deviceKey: string;
    entityId: string;
    operation: RealtimeOperation;
  },
) => {
  try {
    const payload = {
      changedAt: input.changedAt,
      deviceKey: input.deviceKey,
      entityId: input.entityId,
      eventType: PRINTING_REALTIME_EVENT_TYPES.deviceChanged,
      operation: input.operation,
      source: 'print_devices' as const,
    };

    await emitPrintingRealtimeEvent(supabase, {
      event: PRINTING_REALTIME_EVENT_TYPES.deviceChanged,
      payload,
      topic: 'printing:devices',
    });

    await emitPrintSummaryChanged(supabase, {
      changedAt: input.changedAt,
      entityId: input.entityId,
      operation: input.operation,
      source: 'print_devices',
    });
  } catch (error) {
    console.error('Failed to emit print device realtime event', {
      deviceId: input.entityId,
      deviceKey: input.deviceKey,
      error,
      operation: input.operation,
    });
  }
};

export const getPrintJobRealtimeSnapshot = async (
  supabase: PrintingRealtimeClient,
  id: string,
): Promise<PrintJobRealtimeSnapshot | null> => {
  const { data, error } = await supabase
    .from('admin_print_job_list')
    .select('id, work_order_id, status, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id || !data.work_order_id || !data.status) {
    return null;
  }

  return {
    changedAt: resolveChangedAt(data.created_at, data.updated_at),
    entityId: data.id,
    jobStatus: data.status,
    workOrderId: data.work_order_id,
  };
};

export const getPrintDeviceRealtimeSnapshotById = async (
  supabase: PrintingRealtimeClient,
  id: string,
): Promise<PrintDeviceRealtimeSnapshot | null> => {
  const { data, error } = await supabase
    .from('print_devices')
    .select('id, device_key, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id || !data.device_key) {
    return null;
  }

  return {
    changedAt: resolveChangedAt(data.created_at, data.updated_at),
    deviceKey: data.device_key,
    entityId: data.id,
  };
};

export const getPrintDeviceRealtimeSnapshotByKey = async (
  supabase: PrintingRealtimeClient,
  deviceKey: string,
): Promise<PrintDeviceRealtimeSnapshot | null> => {
  const { data, error } = await supabase
    .from('print_devices')
    .select('id, device_key, created_at, updated_at')
    .eq('device_key', deviceKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id || !data.device_key) {
    return null;
  }

  return {
    changedAt: resolveChangedAt(data.created_at, data.updated_at),
    deviceKey: data.device_key,
    entityId: data.id,
  };
};
