import type { Database } from '../../types/database.types';

export type AdminLineNotificationReason =
  | 'ALREADY_NOTIFIED'
  | 'ENQUEUE_FAILED'
  | 'JOB_ALREADY_EXISTS'
  | 'NOT_READY_FOR_PICKUP'
  | 'NO_ACTIVE_LINE_BINDING';

export type AdminLineNotificationSummary =
  | { enqueued: true; jobId: string }
  | { enqueued: false; reason: AdminLineNotificationReason };

export interface AdminWorkOrderLineStatusResponse {
  data: {
    binding:
      | {
          blockedAt: string | null;
          displayName: string | null;
          friendshipCheckedAt: string | null;
          linkedAt: string;
          notificationStatus: 'not_notifyable' | 'notifyable' | 'unknown';
          status: 'bound';
        }
      | {
          blockedAt: null;
          displayName: null;
          friendshipCheckedAt: null;
          linkedAt: null;
          notificationStatus: 'not_notifyable';
          status: 'unbound';
        };
    customerId: string;
    latestToken:
      | { status: 'none' }
      | {
          expiresAt: string;
          id: string;
          revokedAt: string | null;
          status: 'expired' | 'pending' | 'revoked' | 'used';
          usedAt: string | null;
        };
    recentJobs: Array<{
      attempts: number;
      availableAt: string;
      createdAt: string;
      id: string;
      jobType: Database['public']['Enums']['line_job_type'];
      lastError: string | null;
      maxAttempts: number;
      sentAt: string | null;
      skipReason: Database['public']['Enums']['line_job_skip_reason'] | null;
      status: Database['public']['Enums']['line_job_status'];
    }>;
    workOrderId: string;
  };
}

export const getAdminLineBindingLabel = (binding: {
  notificationStatus: 'not_notifyable' | 'notifyable' | 'unknown';
  status: 'bound' | 'unbound';
}) => {
  if (binding.status === 'unbound') return '未綁定';
  if (binding.notificationStatus === 'notifyable') return '已綁定・可通知';
  if (binding.notificationStatus === 'not_notifyable') return '已綁定・尚未加入或已封鎖';
  return '已綁定・通知狀態未知';
};

const TOKEN_STATUS_LABELS = {
  expired: '已過期',
  none: '無',
  pending: '待綁定',
  revoked: '已撤銷',
  used: '已使用',
} as const;

export const getAdminLineTokenStatusLabel = (status: keyof typeof TOKEN_STATUS_LABELS) =>
  TOKEN_STATUS_LABELS[status];

const JOB_STATUS_LABELS = {
  failed: '發送失敗',
  locked: '處理中',
  pending: '等待發送',
  skipped: '已略過',
  succeeded: 'LINE API 已接受',
} as const satisfies Record<Database['public']['Enums']['line_job_status'], string>;

export const getAdminLineJobStatusLabel = (
  status: Database['public']['Enums']['line_job_status'],
) => JOB_STATUS_LABELS[status];

const JOB_TYPE_LABELS = {
  line_binding_success: '綁定成功通知',
  work_order_ready_for_pickup: '完工待取通知',
  work_order_received: '收件通知',
} as const satisfies Record<Database['public']['Enums']['line_job_type'], string>;

export const getAdminLineJobTypeLabel = (type: Database['public']['Enums']['line_job_type']) =>
  JOB_TYPE_LABELS[type];

const SKIP_REASON_LABELS = {
  line_not_notifyable: '尚未加入或已封鎖',
  no_active_line_binding: '無有效 LINE 綁定',
  recipient_binding_changed: '綁定帳號已變更',
} as const satisfies Record<Database['public']['Enums']['line_job_skip_reason'], string>;

export const getAdminLineSkipReasonLabel = (
  reason: Database['public']['Enums']['line_job_skip_reason'] | null,
) => (reason ? SKIP_REASON_LABELS[reason] : null);

export const getAdminLineNotificationFeedback = (summary: AdminLineNotificationSummary) => {
  if (summary.enqueued) {
    return { message: 'LINE 通知已排入佇列', tone: 'success' as const };
  }

  const feedback = {
    ALREADY_NOTIFIED: { message: '已通知過，不重複通知', tone: 'info' as const },
    ENQUEUE_FAILED: {
      message: '主流程已完成，但 LINE 通知排入佇列失敗',
      tone: 'warning' as const,
    },
    JOB_ALREADY_EXISTS: { message: 'LINE 通知已存在，不重複建立', tone: 'info' as const },
    NO_ACTIVE_LINE_BINDING: {
      message: '顧客尚未綁定 LINE，不會自動通知',
      tone: 'info' as const,
    },
  } as const;

  return summary.reason === 'NOT_READY_FOR_PICKUP' ? null : feedback[summary.reason];
};
