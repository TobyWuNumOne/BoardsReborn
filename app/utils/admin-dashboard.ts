export interface AdminDashboardSummary {
  activeWorkOrders: number;
  activeWorkOrdersByStatus: {
    RECEIVED: number;
    DRYING: number;
    REPAIRING: number;
  };
  createdToday: number;
  overdue: number;
  readyForPickup: number;
}

export type AdminDashboardBoardTypeKey = 'SNOWBOARD' | 'SUP' | 'SURFBOARD';
export type AdminDashboardSurfboardLengthKey = 'LONGBOARD' | 'MID_LENGTH' | 'SHORTBOARD';
export type AdminDashboardStatusKey = 'DRYING' | 'READY_FOR_PICKUP' | 'RECEIVED' | 'REPAIRING';
export type AdminDashboardIntakePeriod = 'monthly' | 'weekly';

export interface AdminDashboardMonthlyIntakePoint {
  count: number;
  label: string;
  month: string;
}

export interface AdminDashboardWeeklyIntakePoint {
  count: number;
  endDate: string;
  label: string;
  startDate: string;
  week: string;
}

export interface AdminDashboardBreakdownPoint<T extends string = string> {
  count: number;
  key: T;
  label: string;
  share: number;
}

export interface AdminDashboardStats {
  averageMonthlyIntake: number;
  boardTypeBreakdown: Array<AdminDashboardBreakdownPoint<AdminDashboardBoardTypeKey>>;
  busiestMonth: AdminDashboardMonthlyIntakePoint | null;
  last12MonthsIntake: number;
  last12WeeksIntake: number;
  monthlyIntake: AdminDashboardMonthlyIntakePoint[];
  receivedPreviousMonth: number;
  receivedPreviousWeek: number;
  receivedThisMonth: number;
  receivedThisWeek: number;
  statusBreakdown: Array<AdminDashboardBreakdownPoint<AdminDashboardStatusKey>>;
  surfboardLengthBreakdown: Array<AdminDashboardBreakdownPoint<AdminDashboardSurfboardLengthKey>>;
  weeklyIntake: AdminDashboardWeeklyIntakePoint[];
}

export interface AdminDashboardResponse {
  data: {
    generatedAt: string;
    stats: AdminDashboardStats;
    summary: AdminDashboardSummary;
  };
}

export interface AdminDashboardSummaryCardDefinition {
  description: string;
  key: 'createdToday' | 'overdue' | 'readyForPickup';
  label: string;
  to?: string;
}

export interface AdminDashboardProcessingCardDefinition {
  description: string;
  key: keyof AdminDashboardSummary['activeWorkOrdersByStatus'];
  label: string;
  to: string;
}

const DASHBOARD_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
});
const normalizeFormattedDashboardDateTime = (value: string) => value.replace(/\p{Zs}/gu, ' ');

export const ADMIN_DASHBOARD_STATUS_LABELS = {
  DRYING: '除濕中',
  READY_FOR_PICKUP: '待取件',
  RECEIVED: '已收件',
  REPAIRING: '維修中',
} as const satisfies Record<AdminDashboardStatusKey, string>;

export const ADMIN_DASHBOARD_BOARD_TYPE_LABELS = {
  SNOWBOARD: '雪板',
  SUP: 'SUP',
  SURFBOARD: '衝浪板',
} as const satisfies Record<AdminDashboardBoardTypeKey, string>;

export const ADMIN_DASHBOARD_SURFBOARD_LENGTH_LABELS = {
  LONGBOARD: '長板',
  MID_LENGTH: '中長板',
  SHORTBOARD: '短板',
} as const satisfies Record<AdminDashboardSurfboardLengthKey, string>;

export const ADMIN_DASHBOARD_INTAKE_PERIOD_OPTIONS: ReadonlyArray<{
  label: string;
  value: AdminDashboardIntakePeriod;
}> = [
  { label: '近 12 週', value: 'weekly' },
  { label: '近 12 個月', value: 'monthly' },
] as const;

export const ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS: ReadonlyArray<AdminDashboardProcessingCardDefinition> =
  [
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
  ] as const;

export const ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS: ReadonlyArray<AdminDashboardSummaryCardDefinition> =
  [
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
  ] as const;

export const createEmptyAdminDashboardResponse = (): AdminDashboardResponse => ({
  data: {
    generatedAt: '',
    stats: {
      averageMonthlyIntake: 0,
      boardTypeBreakdown: [
        {
          count: 0,
          key: 'SURFBOARD',
          label: ADMIN_DASHBOARD_BOARD_TYPE_LABELS.SURFBOARD,
          share: 0,
        },
        { count: 0, key: 'SUP', label: ADMIN_DASHBOARD_BOARD_TYPE_LABELS.SUP, share: 0 },
        {
          count: 0,
          key: 'SNOWBOARD',
          label: ADMIN_DASHBOARD_BOARD_TYPE_LABELS.SNOWBOARD,
          share: 0,
        },
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
        { count: 0, key: 'RECEIVED', label: ADMIN_DASHBOARD_STATUS_LABELS.RECEIVED, share: 0 },
        { count: 0, key: 'DRYING', label: ADMIN_DASHBOARD_STATUS_LABELS.DRYING, share: 0 },
        { count: 0, key: 'REPAIRING', label: ADMIN_DASHBOARD_STATUS_LABELS.REPAIRING, share: 0 },
        {
          count: 0,
          key: 'READY_FOR_PICKUP',
          label: ADMIN_DASHBOARD_STATUS_LABELS.READY_FOR_PICKUP,
          share: 0,
        },
      ],
      surfboardLengthBreakdown: [
        {
          count: 0,
          key: 'SHORTBOARD',
          label: ADMIN_DASHBOARD_SURFBOARD_LENGTH_LABELS.SHORTBOARD,
          share: 0,
        },
        {
          count: 0,
          key: 'MID_LENGTH',
          label: ADMIN_DASHBOARD_SURFBOARD_LENGTH_LABELS.MID_LENGTH,
          share: 0,
        },
        {
          count: 0,
          key: 'LONGBOARD',
          label: ADMIN_DASHBOARD_SURFBOARD_LENGTH_LABELS.LONGBOARD,
          share: 0,
        },
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

export const formatAdminDashboardGeneratedAt = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return normalizeFormattedDashboardDateTime(DASHBOARD_DATE_TIME_FORMATTER.format(date));
};

export const formatAdminDashboardMonthlyAverage = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

export const formatAdminDashboardDelta = (current: number, previous: number) => {
  const delta = current - previous;

  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
};

export const getAdminDashboardIntakePoints = (
  stats: AdminDashboardStats,
  period: AdminDashboardIntakePeriod,
) => (period === 'weekly' ? stats.weeklyIntake : stats.monthlyIntake);

export const getAdminDashboardIntakeTotal = (
  stats: AdminDashboardStats,
  period: AdminDashboardIntakePeriod,
) => (period === 'weekly' ? stats.last12WeeksIntake : stats.last12MonthsIntake);

export const getAdminDashboardCurrentIntake = (
  stats: AdminDashboardStats,
  period: AdminDashboardIntakePeriod,
) => (period === 'weekly' ? stats.receivedThisWeek : stats.receivedThisMonth);

export const getAdminDashboardPreviousIntake = (
  stats: AdminDashboardStats,
  period: AdminDashboardIntakePeriod,
) => (period === 'weekly' ? stats.receivedPreviousWeek : stats.receivedPreviousMonth);

export const getAdminDashboardIntakePeriodLabel = (period: AdminDashboardIntakePeriod) =>
  period === 'weekly' ? '近 12 週' : '近 12 個月';

export const getAdminDashboardCurrentPeriodLabel = (period: AdminDashboardIntakePeriod) =>
  period === 'weekly' ? '本週收件' : '本月收件';

export const getAdminDashboardPreviousPeriodLabel = (period: AdminDashboardIntakePeriod) =>
  period === 'weekly' ? '較上週' : '較上月';

export const formatBoardCount = (value: number) => `${value} 張板`;
