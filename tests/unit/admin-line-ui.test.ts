import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAdminLineBindingLabel,
  getAdminLineJobStatusLabel,
  getAdminLineNotificationFeedback,
  getAdminLineTokenStatusLabel,
} from '../../app/utils/admin-line';

const cardSource = readFileSync(
  resolve(process.cwd(), 'app/components/work-orders/WorkOrderLineStatusCard.vue'),
  'utf8',
);
const detailSource = readFileSync(
  resolve(process.cwd(), 'app/pages/admin/work-orders/[id].vue'),
  'utf8',
);
const createSource = readFileSync(
  resolve(process.cwd(), 'app/pages/admin/work-orders/new.vue'),
  'utf8',
);

describe('admin LINE UI', () => {
  it('labels binding and notification states explicitly', () => {
    expect(
      getAdminLineBindingLabel({ status: 'unbound', notificationStatus: 'not_notifyable' }),
    ).toBe('未綁定');
    expect(getAdminLineBindingLabel({ status: 'bound', notificationStatus: 'notifyable' })).toBe(
      '已綁定・可通知',
    );
    expect(
      getAdminLineBindingLabel({ status: 'bound', notificationStatus: 'not_notifyable' }),
    ).toBe('已綁定・尚未加入或已封鎖');
    expect(getAdminLineBindingLabel({ status: 'bound', notificationStatus: 'unknown' })).toBe(
      '已綁定・通知狀態未知',
    );
  });

  it('labels every token state and LINE job state', () => {
    expect(
      ['none', 'pending', 'used', 'expired', 'revoked'].map(getAdminLineTokenStatusLabel),
    ).toEqual(['無', '待綁定', '已使用', '已過期', '已撤銷']);
    expect(getAdminLineJobStatusLabel('pending')).toBe('等待發送');
    expect(getAdminLineJobStatusLabel('locked')).toBe('處理中');
    expect(getAdminLineJobStatusLabel('succeeded')).toBe('LINE API 已接受');
    expect(getAdminLineJobStatusLabel('failed')).toBe('發送失敗');
    expect(getAdminLineJobStatusLabel('skipped')).toBe('已略過');
  });

  it('maps notification summaries without treating no-op reasons as errors', () => {
    expect(getAdminLineNotificationFeedback({ enqueued: true, jobId: 'job-1' })).toEqual({
      message: 'LINE 通知已排入佇列',
      tone: 'success',
    });
    expect(
      getAdminLineNotificationFeedback({ enqueued: false, reason: 'NO_ACTIVE_LINE_BINDING' }),
    ).toEqual({ message: '顧客尚未綁定 LINE，不會自動通知', tone: 'info' });
    expect(
      getAdminLineNotificationFeedback({ enqueued: false, reason: 'JOB_ALREADY_EXISTS' }),
    ).toEqual({ message: 'LINE 通知已存在，不重複建立', tone: 'info' });
    expect(
      getAdminLineNotificationFeedback({ enqueued: false, reason: 'ALREADY_NOTIFIED' }),
    ).toEqual({ message: '已通知過，不重複通知', tone: 'info' });
    expect(getAdminLineNotificationFeedback({ enqueued: false, reason: 'ENQUEUE_FAILED' })).toEqual(
      { message: '主流程已完成，但 LINE 通知排入佇列失敗', tone: 'warning' },
    );
    expect(
      getAdminLineNotificationFeedback({ enqueued: false, reason: 'NOT_READY_FOR_PICKUP' }),
    ).toBeNull();
  });

  it('uses existing admin endpoints, refetches after actions and includes confirmation copy', () => {
    expect(cardSource).toContain('/line-status');
    expect(cardSource).toContain('/line-bind-token');
    expect(cardSource).toContain('/line-binding');
    expect(cardSource).toContain('await refreshLineStatus()');
    expect(cardSource).toContain('舊 QR 不會重新變成可綁定');
    expect(cardSource).toContain('需要重新發卡');
    expect(cardSource).toContain('navigator.clipboard.writeText');
    expect(cardSource).not.toContain('line_user_id');
    expect(cardSource).not.toContain('token_hash');
    expect(cardSource).not.toContain('prepared_messages');
    expect(cardSource).not.toContain('recipient_line_user_id');
  });

  it('mounts the card on detail and handles create/status notification summaries', () => {
    expect(detailSource).toContain(
      "import WorkOrderLineStatusCard from '~/components/work-orders/WorkOrderLineStatusCard.vue';",
    );
    expect(detailSource).toContain('<WorkOrderLineStatusCard');
    expect(detailSource).toContain('getAdminLineNotificationFeedback');
    expect(createSource).toContain('getAdminLineNotificationFeedback');
  });
});
