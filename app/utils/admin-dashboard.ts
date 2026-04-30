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

export interface AdminDashboardResponse {
  data: {
    generatedAt: string;
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

  return DASHBOARD_DATE_TIME_FORMATTER.format(date);
};
