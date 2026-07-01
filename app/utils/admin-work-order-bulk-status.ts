import { z } from 'zod';
import type { Database } from '../../types/database.types';
import type {
  AdminWorkOrderBulkStatusResponse,
  AdminWorkOrderResolveItem,
} from './admin-work-orders';
import { getApiErrorStatusCode, getWorkOrderStatusLabel } from './admin-work-orders';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];

export const ADMIN_BULK_STATUS_RESOLVE_CONCURRENCY = 6;
export const ADMIN_BULK_STATUS_GROUP_ORDER = [
  'RECEIVED',
  'DRYING',
  'REPAIRING',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CANCELLED',
] as const satisfies ReadonlyArray<WorkOrderStatus>;

export interface AdminBulkStatusPreviewResult {
  found: AdminWorkOrderResolveItem[];
  notFound: string[];
}

export interface AdminBulkStatusPreviewGroup {
  items: AdminWorkOrderResolveItem[];
  key: WorkOrderStatus;
  label: string;
  nextStatus: WorkOrderStatus | null;
  selectedCount: number;
  totalCount: number;
}

export interface AdminBulkStatusSubmitPayload {
  note: string | null;
  paperOrderNos: string[];
  status: WorkOrderStatus;
}

export interface AdminBulkStatusSubmitPayloadResult {
  fieldErrors: Record<string, string[]>;
  payload: AdminBulkStatusSubmitPayload | null;
}

type AdminBulkStatusResolveFn = (paperOrderNo: string) => Promise<AdminWorkOrderResolveItem>;

const bulkStatusSchema = z.object({
  note: z.string().nullable(),
  paperOrderNos: z.array(z.string()).min(1, '請至少選取一筆工單。'),
  status: z.enum(ADMIN_BULK_STATUS_GROUP_ORDER),
});

const normalizeNullableText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
};

export const parseAdminBulkStatusPaperOrderNos = (value: string) => {
  const tokens = value
    .split(/[\s,]+/u)
    .map((token) => token.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueTokens: string[] = [];

  for (const token of tokens) {
    if (seen.has(token)) {
      continue;
    }

    seen.add(token);
    uniqueTokens.push(token);
  }

  return uniqueTokens;
};

export const getAdminBulkStatusQuickTarget = (status: WorkOrderStatus): WorkOrderStatus | null => {
  switch (status) {
    case 'RECEIVED':
      return 'REPAIRING';
    case 'DRYING':
      return 'REPAIRING';
    case 'REPAIRING':
      return 'READY_FOR_PICKUP';
    case 'READY_FOR_PICKUP':
      return 'DELIVERED';
    case 'DELIVERED':
    case 'CANCELLED':
      return null;
    default:
      return null;
  }
};

export const getAdminBulkStatusSkipReasonLabel = (
  reason: AdminWorkOrderBulkStatusResponse['data']['skipped'][number]['reason'],
) => {
  switch (reason) {
    case 'INVALID_STATUS_TRANSITION':
      return '狀態轉換不合法';
    case 'NOT_FOUND':
      return '查無工單';
    default:
      return '略過';
  }
};

export const buildAdminBulkStatusSubmitPayload = (
  paperOrderNos: string[],
  status: WorkOrderStatus | '',
  note: string,
): AdminBulkStatusSubmitPayloadResult => {
  const fieldErrors: Record<string, string[]> = {};

  if (!status) {
    fieldErrors.status = ['請選擇目標狀態。'];
  }

  const payload: AdminBulkStatusSubmitPayload = {
    note: normalizeNullableText(note),
    paperOrderNos,
    status: (status || 'RECEIVED') as WorkOrderStatus,
  };

  const parsedPayload = bulkStatusSchema.safeParse(payload);

  if (!parsedPayload.success) {
    for (const issue of parsedPayload.error.issues) {
      const field = issue.path[0];

      if (typeof field === 'string') {
        fieldErrors[field] ??= [];
        fieldErrors[field].push(issue.message);
      }
    }
  }

  return {
    fieldErrors,
    payload: Object.keys(fieldErrors).length > 0 ? null : payload,
  };
};

export const getAdminBulkStatusSelectedPaperOrderNos = (
  items: AdminWorkOrderResolveItem[],
  selectedPaperOrderNos: string[],
) => {
  const selectedSet = new Set(selectedPaperOrderNos);

  return items
    .filter((item) => selectedSet.has(item.paperOrderNo))
    .map((item) => item.paperOrderNo);
};

export const hasAdminBulkStatusSelectedSnowboards = (
  items: AdminWorkOrderResolveItem[],
  selectedPaperOrderNos: string[],
) => {
  const selectedSet = new Set(selectedPaperOrderNos);

  return items.some(
    (item) => selectedSet.has(item.paperOrderNo) && item.board.boardType === 'SNOWBOARD',
  );
};

export const getAdminBulkStatusSelectedUnpaidItems = (
  items: AdminWorkOrderResolveItem[],
  selectedPaperOrderNos: string[],
) => {
  const selectedSet = new Set(selectedPaperOrderNos);

  return items.filter(
    (item) => selectedSet.has(item.paperOrderNo) && item.paymentReceived !== true,
  );
};

export const groupAdminBulkStatusPreviewItems = (
  items: AdminWorkOrderResolveItem[],
  selectedPaperOrderNos: string[],
): AdminBulkStatusPreviewGroup[] => {
  const selectedSet = new Set(selectedPaperOrderNos);

  return ADMIN_BULK_STATUS_GROUP_ORDER.map((status) => {
    const groupedItems = items.filter((item) => item.currentStatus === status);

    return {
      items: groupedItems,
      key: status,
      label: getWorkOrderStatusLabel(status),
      nextStatus: getAdminBulkStatusQuickTarget(status),
      selectedCount: groupedItems.filter((item) => selectedSet.has(item.paperOrderNo)).length,
      totalCount: groupedItems.length,
    };
  }).filter((group) => group.totalCount > 0);
};

export const resolveAdminBulkStatusPreview = async (
  paperOrderNos: string[],
  resolveWorkOrder: AdminBulkStatusResolveFn,
  concurrency = ADMIN_BULK_STATUS_RESOLVE_CONCURRENCY,
): Promise<AdminBulkStatusPreviewResult> => {
  const foundByIndex = new Map<number, AdminWorkOrderResolveItem>();
  const notFoundByIndex = new Map<number, string>();
  let authError: unknown = null;
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(concurrency, paperOrderNos.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (authError) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= paperOrderNos.length) {
        return;
      }

      const paperOrderNo = paperOrderNos[currentIndex];

      if (!paperOrderNo) {
        continue;
      }

      try {
        const resolvedWorkOrder = await resolveWorkOrder(paperOrderNo);
        foundByIndex.set(currentIndex, resolvedWorkOrder);
      } catch (error) {
        const statusCode = getApiErrorStatusCode(error);

        if (statusCode === 401 || statusCode === 403) {
          authError = error;
          return;
        }

        notFoundByIndex.set(currentIndex, paperOrderNo);
      }
    }
  });

  await Promise.all(workers);

  if (authError) {
    throw authError;
  }

  return {
    found: Array.from(foundByIndex.entries())
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([, item]) => item),
    notFound: Array.from(notFoundByIndex.entries())
      .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
      .map(([, paperOrderNo]) => paperOrderNo),
  };
};
