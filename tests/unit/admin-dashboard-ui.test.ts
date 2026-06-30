import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_DASHBOARD_INTAKE_PERIOD_OPTIONS,
  ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS,
  ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS,
  createEmptyAdminDashboardResponse,
  formatBoardCount,
  formatAdminDashboardDelta,
  formatAdminDashboardGeneratedAt,
  formatAdminDashboardMonthlyAverage,
  getAdminDashboardCurrentIntake,
  getAdminDashboardCurrentPeriodLabel,
  getAdminDashboardIntakePeriodLabel,
  getAdminDashboardIntakePoints,
  getAdminDashboardIntakeTotal,
  getAdminDashboardPreviousIntake,
  getAdminDashboardPreviousPeriodLabel,
} from '../../app/utils/admin-dashboard';

const intakeBarChartSource = readFileSync(
  resolve(process.cwd(), 'app/components/admin/IntakeBarChart.vue'),
  'utf8',
);

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
          last12WeeksIntake: 0,
          monthlyIntake: [],
          receivedPreviousMonth: 0,
          receivedPreviousWeek: 0,
          receivedThisMonth: 0,
          receivedThisWeek: 0,
          statusBreakdown: [
            { count: 0, key: 'RECEIVED', label: '已收件', share: 0 },
            { count: 0, key: 'DRYING', label: '除濕中', share: 0 },
            { count: 0, key: 'REPAIRING', label: '維修中', share: 0 },
            { count: 0, key: 'READY_FOR_PICKUP', label: '待取件', share: 0 },
          ],
          surfboardLengthBreakdown: [
            { count: 0, key: 'SHORTBOARD', label: '短板', share: 0 },
            { count: 0, key: 'MID_LENGTH', label: '中長板', share: 0 },
            { count: 0, key: 'LONGBOARD', label: '長板', share: 0 },
          ],
          weeklyIntake: [],
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
    expect(formatBoardCount(7)).toBe('7 張板');
  });

  it('resolves dashboard intake period helpers', () => {
    const stats = {
      ...createEmptyAdminDashboardResponse().data.stats,
      last12MonthsIntake: 9,
      last12WeeksIntake: 4,
      monthlyIntake: [{ count: 9, label: '2026/04', month: '2026-04' }],
      receivedPreviousMonth: 6,
      receivedPreviousWeek: 1,
      receivedThisMonth: 9,
      receivedThisWeek: 2,
      weeklyIntake: [
        {
          count: 2,
          endDate: '2026-04-26',
          label: '04/20',
          startDate: '2026-04-20',
          week: '2026-04-20',
        },
      ],
    };

    expect(ADMIN_DASHBOARD_INTAKE_PERIOD_OPTIONS).toEqual([
      { label: '近 12 週', value: 'weekly' },
      { label: '近 12 個月', value: 'monthly' },
    ]);
    expect(getAdminDashboardIntakePoints(stats, 'weekly')).toEqual(stats.weeklyIntake);
    expect(getAdminDashboardIntakePoints(stats, 'monthly')).toEqual(stats.monthlyIntake);
    expect(getAdminDashboardIntakeTotal(stats, 'weekly')).toBe(4);
    expect(getAdminDashboardIntakeTotal(stats, 'monthly')).toBe(9);
    expect(getAdminDashboardCurrentIntake(stats, 'weekly')).toBe(2);
    expect(getAdminDashboardCurrentIntake(stats, 'monthly')).toBe(9);
    expect(getAdminDashboardPreviousIntake(stats, 'weekly')).toBe(1);
    expect(getAdminDashboardPreviousIntake(stats, 'monthly')).toBe(6);
    expect(getAdminDashboardIntakePeriodLabel('weekly')).toBe('近 12 週');
    expect(getAdminDashboardIntakePeriodLabel('monthly')).toBe('近 12 個月');
    expect(getAdminDashboardCurrentPeriodLabel('weekly')).toBe('本週收件');
    expect(getAdminDashboardCurrentPeriodLabel('monthly')).toBe('本月收件');
    expect(getAdminDashboardPreviousPeriodLabel('weekly')).toBe('較上週');
    expect(getAdminDashboardPreviousPeriodLabel('monthly')).toBe('較上月');
  });

  it('keeps chart tooltip rendering outside manual Vue component rendering', () => {
    expect(intakeBarChartSource).not.toContain('componentToString');
    expect(intakeBarChartSource).not.toContain('ChartTooltipContent');
    expect(intakeBarChartSource).toContain('escapeTooltipHtml');
  });
});
