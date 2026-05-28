import type { Database } from '../../types/database.types';

export const ADMIN_PRINTING_REALTIME_DEBOUNCE_MS = 400;
export const ADMIN_PRINTING_REALTIME_FALLBACK_INTERVAL_MS = 60_000;
export const ADMIN_PRINTING_ACTIVE_SUMMARY_REFRESH_INTERVAL_MS = 2_000;

export const ADMIN_PRINTING_REALTIME_TOPICS = [
  'printing:jobs',
  'printing:devices',
  'printing:summary',
] as const;

export type AdminPrintingRealtimeTopic =
  (typeof ADMIN_PRINTING_REALTIME_TOPICS)[number];

export const ADMIN_PRINTING_REALTIME_EVENT_TYPES = {
  deviceChanged: 'print_device.changed',
  jobChanged: 'print_job.changed',
  summaryChanged: 'printing.summary.changed',
} as const;

export type AdminPrintingRealtimeEventType =
  (typeof ADMIN_PRINTING_REALTIME_EVENT_TYPES)[keyof typeof ADMIN_PRINTING_REALTIME_EVENT_TYPES];

export interface AdminPrintingRealtimePayload {
  changedAt: string;
  workOrderId?: string | null;
  entityId: string;
  eventType: AdminPrintingRealtimeEventType;
  operation: 'DELETE' | 'INSERT' | 'UPDATE';
  source: 'print_devices' | 'print_jobs';
  deviceKey?: string | null;
  jobStatus?: Database['public']['Enums']['print_job_status'] | null;
}

export const isAdminPrintingActiveJobStatus = (
  status: Database['public']['Enums']['print_job_status'] | null | undefined,
) => status === 'pending' || status === 'locked' || status === 'printing';

interface AdminPrintingRealtimeRefreshDecisionInput {
  dirty: boolean;
  fallbackIntervalMs: number;
  lastSyncedAt: number;
  now: number;
}

interface AdminPrintingRealtimeFallbackDecisionInput
  extends AdminPrintingRealtimeRefreshDecisionInput {
  isVisible: boolean;
}

export const shouldRefreshAdminPrintingOnVisibility = ({
  dirty,
  fallbackIntervalMs,
  lastSyncedAt,
  now,
}: AdminPrintingRealtimeRefreshDecisionInput) =>
  dirty || now - lastSyncedAt >= fallbackIntervalMs;

export const shouldRunAdminPrintingFallbackRefresh = ({
  dirty,
  fallbackIntervalMs,
  isVisible,
  lastSyncedAt,
  now,
}: AdminPrintingRealtimeFallbackDecisionInput) =>
  isVisible
  && shouldRefreshAdminPrintingOnVisibility({
    dirty,
    fallbackIntervalMs,
    lastSyncedAt,
    now,
  });
