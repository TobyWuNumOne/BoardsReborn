import { describe, expect, it } from 'vitest';
import {
  ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS,
  ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS,
  createEmptyAdminDashboardResponse,
  formatAdminDashboardDelta,
  formatAdminDashboardGeneratedAt,
  formatAdminDashboardMonthlyAverage,
} from '../../app/utils/admin-dashboard';

describe('admin dashboard UI helpers', () => {
  it('keeps processing and summary card routes explicit', () => {
    expect(ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS).toEqual([
      {
        description: '剛完成收件，等待進入下一步作業。',
        key: 'RECEIVED',
        label: '已收件',
        to: '/admin/work-orders?status=RECEIVED',
      },
      {
        description: '已進入除濕流程，可直接查看除濕中的工單。',
        key: 'DRYING',
        label: '除濕中',
        to: '/admin/work-orders?status=DRYING',
      },
      {
        description: '正在維修中的工單，可直接查看目前施工清單。',
        key: 'REPAIRING',
        label: '維修中',
        to: '/admin/work-orders?status=REPAIRING',
      },
    ]);

    expect(ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS).toEqual([
      {
        description: '已完工待取件，可直接查看待取件清單。',
        key: 'readyForPickup',
        label: '待取件',
        to: '/admin/work-orders?status=READY_FOR_PICKUP',
      },
      {
        description: '超過預估完成日的工單，可直接查看逾期清單。',
        key: 'overdue',
        label: '逾期',
        to: '/admin/work-orders?overdueEstimatedCompletion=true',
      },
      {
        description: '依 Asia/Taipei 今日建立時間計算。',
        key: 'createdToday',
        label: '今日新建',
      },
    ]);
  });

  it('formats generatedAt only as display text and defaults safely', () => {
    expect(createEmptyAdminDashboardResponse()).toEqual({
      data: {
        generatedAt: '',
        stats: {
          averageMonthlyIntake: 0,
          boardTypeBreakdown: [
            { count: 0, key: 'SURFBOARD', label: '衝浪板', share: 0 },
            { count: 0, key: 'SUP', label: 'SUP', share: 0 },
            { count: 0, key: 'SNOWBOARD', label: '雪板', share: 0 },
          ],
          busiestMonth: null,
          last12MonthsIntake: 0,
          monthlyIntake: [],
          receivedPreviousMonth: 0,
          receivedThisMonth: 0,
          statusBreakdown: [
            { count: 0, key: 'RECEIVED', label: '已收件', share: 0 },
            { count: 0, key: 'DRYING', label: '除濕中', share: 0 },
            { count: 0, key: 'REPAIRING', label: '維修中', share: 0 },
            { count: 0, key: 'READY_FOR_PICKUP', label: '待取件', share: 0 },
            { count: 0, key: 'DELIVERED', label: '已交件', share: 0 },
            { count: 0, key: 'CANCELLED', label: '已取消', share: 0 },
          ],
        },
        summary: {
          activeWorkOrders: 0,
          activeWorkOrdersByStatus: {
            RECEIVED: 0,
            DRYING: 0,
            REPAIRING: 0,
          },
          createdToday: 0,
          overdue: 0,
          readyForPickup: 0,
        },
      },
    });
    expect(formatAdminDashboardGeneratedAt('2026-04-29T02:45:00.000Z')).toBe('2026/04/29 10:45');
    expect(formatAdminDashboardGeneratedAt('')).toBe('—');
    expect(formatAdminDashboardGeneratedAt('broken')).toBe('—');
  });

  it('formats dashboard stat helper values predictably', () => {
    expect(formatAdminDashboardMonthlyAverage(0)).toBe('0');
    expect(formatAdminDashboardMonthlyAverage(3)).toBe('3');
    expect(formatAdminDashboardMonthlyAverage(2.25)).toBe('2.3');
    expect(formatAdminDashboardDelta(8, 5)).toBe('+3');
    expect(formatAdminDashboardDelta(5, 8)).toBe('-3');
    expect(formatAdminDashboardDelta(5, 5)).toBe('0');
  });
});
