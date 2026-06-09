import { z } from 'zod';
import type { Database } from '../../types/database.types';
import { normalizeTaiwanMobilePhoneInput } from './phone';
import type { RepairCountSource, RepairMark } from './repair-marks';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type BoardType = Database['public']['Enums']['board_type'];

export type PublicProgressStepState = 'current' | 'done' | 'upcoming';
export type PublicProgressStepKey =
  | 'DELIVERED'
  | 'DRYING'
  | 'READY_FOR_PICKUP'
  | 'RECEIVED'
  | 'REPAIRING';

export interface PublicWorkOrderLookupProgressTimeline {
  currentStepKey: PublicProgressStepKey;
  kind: 'timeline';
  steps: Array<{
    key: PublicProgressStepKey;
    label: string;
    state: PublicProgressStepState;
  }>;
}

export interface PublicWorkOrderLookupProgressCancelled {
  kind: 'cancelled';
  message: string;
}

export type PublicWorkOrderLookupProgress =
  | PublicWorkOrderLookupProgressTimeline
  | PublicWorkOrderLookupProgressCancelled;

export interface PublicWorkOrderLookupResponse {
  data: {
    boardType: BoardType;
    currentStatus: WorkOrderStatus;
    estimatedCompletionDate: string | null;
    initialQuoteAmount: number | null;
    lastUpdatedAt: string;
    paperOrderNo: string;
    progress: PublicWorkOrderLookupProgress;
    publicNote: string | null;
    repairCount: number | null;
    repairCountSource: RepairCountSource;
    repairMarkCount: number;
    repairMarks: RepairMark[];
    statusLabel: string;
  };
}

export interface PublicWorkOrderLookupFormState {
  paperOrderNo: string;
  phone: string;
}

export interface PublicWorkOrderLookupPayload {
  paperOrderNo: string;
  phone: string;
}

export interface PublicApiErrorEnvelope {
  error: {
    code: string;
    fieldErrors?: Record<string, string[]>;
    message: string;
    requestId?: string;
  };
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-TW', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
});

const lookupFormSchema = z.object({
  paperOrderNo: z.string(),
  phone: z.string(),
});

const toFieldErrors = (error: z.ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field !== 'string') {
      continue;
    }

    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return fieldErrors;
};

const trimValue = (value: string | null | undefined) => value?.trim() ?? '';

export const createPublicWorkOrderLookupFormState = (): PublicWorkOrderLookupFormState => ({
  paperOrderNo: '',
  phone: '',
});

export const buildPublicWorkOrderLookupPayload = (
  formState: PublicWorkOrderLookupFormState,
): {
  data?: PublicWorkOrderLookupPayload;
  fieldErrors?: Record<string, string[]>;
} => {
  const parsedForm = lookupFormSchema.safeParse(formState);

  if (!parsedForm.success) {
    return { fieldErrors: toFieldErrors(parsedForm.error) };
  }

  const paperOrderNo = trimValue(parsedForm.data.paperOrderNo);
  const normalizedPhone = normalizeTaiwanMobilePhoneInput(parsedForm.data.phone);
  const fieldErrors: Record<string, string[]> = {};

  if (!paperOrderNo) {
    fieldErrors.paperOrderNo = ['請輸入紙本工單號。'];
  } else if (paperOrderNo.length < 3) {
    fieldErrors.paperOrderNo = ['紙本工單號至少 3 碼。'];
  } else if (paperOrderNo.length > 50) {
    fieldErrors.paperOrderNo = ['紙本工單號不可超過 50 碼。'];
  }

  if (!normalizedPhone) {
    fieldErrors.phone = ['請輸入完整台灣手機號碼。'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return {
    data: {
      paperOrderNo,
      phone: normalizedPhone as string,
    },
  };
};

export const formatPublicDate = (value: string | null) => {
  if (!value) {
    return '未提供';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replaceAll('-', '/');
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return '未提供';
  }

  return DATE_TIME_FORMATTER.format(parsedValue).split(' ')[0] ?? '未提供';
};

export const formatPublicDateTime = (value: string | null) => {
  if (!value) {
    return '未提供';
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return '未提供';
  }

  return DATE_TIME_FORMATTER.format(parsedValue);
};

export const formatPublicCurrency = (value: number | null) => {
  if (value === null) {
    return '未提供';
  }

  return `NT$ ${new Intl.NumberFormat('zh-TW').format(value)}`;
};

export const extractPublicApiErrorEnvelope = (error: unknown): PublicApiErrorEnvelope | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('data' in error && error.data && typeof error.data === 'object' && 'error' in error.data) {
    return error.data as PublicApiErrorEnvelope;
  }

  if ('error' in error && error.error && typeof error.error === 'object') {
    return error as PublicApiErrorEnvelope;
  }

  return null;
};
