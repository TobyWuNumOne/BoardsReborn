import { z } from 'zod';
import type { Database } from '../../types/database.types';
import { normalizeTaiwanMobilePhoneInput } from './phone';

type BoardType = Database['public']['Enums']['board_type'];
type BoardLengthClass = Database['public']['Enums']['board_length_class'];
type WorkOrderStatus = Database['public']['Enums']['work_order_status'];

const BOARD_TYPES = ['SURFBOARD', 'SUP', 'SNOWBOARD'] as const;
const BOARD_LENGTH_CLASSES = ['SHORTBOARD', 'MID_LENGTH', 'LONGBOARD'] as const;
const BOARD_COLOR_OPTIONS = [
  'WHITE',
  'BLACK',
  'BLUE',
  'RED',
  'YELLOW',
  'GREEN',
  'GRAY',
  'OTHER',
] as const;
const CUSTOMER_MODE_DECISIONS = ['unresolved', 'create', 'reuse'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const taipeiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Taipei',
  year: 'numeric',
});

export type AdminWorkOrderCreateCustomerModeDecision = (typeof CUSTOMER_MODE_DECISIONS)[number];
export type AdminWorkOrderBoardColorOption = (typeof BOARD_COLOR_OPTIONS)[number];

export interface AdminCustomerLookupCandidate {
  createdAt: string | null;
  id: string;
  name: string | null;
  phone: string | null;
}

export interface AdminCustomerLookupResponse {
  data: Array<AdminCustomerLookupCandidate>;
}

export interface AdminWorkOrderCreateResponse {
  data: {
    createdAt: string;
    currentStatus: WorkOrderStatus;
    id: string;
    paperOrderNo: string;
    quoteTotalAmount: number;
  };
}

export interface AdminWorkOrderCreateFormState {
  boardBrand: string;
  boardLengthClass: BoardLengthClass | '';
  boardColorChoice: AdminWorkOrderBoardColorOption | '';
  boardColorOther: string;
  boardModel: string;
  boardSizeLabel: string;
  boardType: BoardType | '';
  customerModeDecision: AdminWorkOrderCreateCustomerModeDecision;
  customerName: string;
  customerPhone: string;
  damageDescription: string;
  estimatedCompletionDate: string;
  estimatedCompletionDateManuallyEdited: boolean;
  initialQuoteAmount: string;
  initialQuoteDescription: string;
  intakeDate: string;
  internalNote: string;
  paperOrderNo: string;
  paymentReceived: boolean;
  publicNote: string;
  selectedCustomerId: string;
}

export interface AdminWorkOrderCreateNormalizedSnapshot {
  boardBrand: string;
  boardLengthClass: BoardLengthClass | '';
  boardColorChoice: AdminWorkOrderBoardColorOption | '';
  boardColorOther: string;
  boardModel: string;
  boardSizeLabel: string;
  boardType: BoardType | '';
  customerModeDecision: AdminWorkOrderCreateCustomerModeDecision;
  customerName: string;
  customerPhone: string;
  damageDescription: string;
  estimatedCompletionDate: string;
  initialQuoteAmount: string;
  initialQuoteDescription: string;
  intakeDate: string;
  internalNote: string;
  paperOrderNo: string;
  paymentReceived: boolean;
  publicNote: string;
  selectedCustomerId: string;
}

export interface AdminWorkOrderCreatePayload {
  board: {
    boardLengthClass?: BoardLengthClass | null;
    boardType: BoardType;
    brand?: string | null;
    color?: string | null;
    model?: string | null;
    sizeLabel?: string | null;
  };
  customer?: {
    name: string;
    phone: string;
  };
  customerId?: string;
  customerMode: 'create' | 'reuse';
  quoteItems: Array<{
    amount: number;
    description: string;
    itemType: 'INITIAL';
  }>;
  workOrder: {
    damageDescription: string;
    estimatedCompletionDate: string;
    intakeDate: string;
    internalNote?: string | null;
    paperOrderNo: string;
    paymentReceived: boolean;
    publicNote?: string | null;
  };
}

export const ADMIN_WORK_ORDER_CREATE_BOARD_TYPE_OPTIONS = [
  { description: '經典短板、長板與一般衝浪板', label: '衝浪板', value: 'SURFBOARD' },
  { description: 'Stand Up Paddle 板型', label: 'SUP', value: 'SUP' },
  { description: '雪季維修板型，不進除濕流程', label: '雪板', value: 'SNOWBOARD' },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: BoardType;
}>;

export const ADMIN_WORK_ORDER_CREATE_BOARD_LENGTH_CLASS_OPTIONS = [
  { description: '高機動與短板操作取向', label: '短板', value: 'SHORTBOARD' },
  { description: '介於短板與長板之間的中尺寸板型', label: '中尺寸', value: 'MID_LENGTH' },
  { description: '長板與長距離巡航板型', label: '長板', value: 'LONGBOARD' },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: BoardLengthClass;
}>;

export const ADMIN_WORK_ORDER_CREATE_BOARD_COLOR_OPTIONS = [
  {
    className: 'border-slate-300 bg-white text-slate-700',
    label: '白',
    value: 'WHITE',
  },
  {
    className: 'border-slate-900 bg-slate-950 text-white',
    label: '黑',
    value: 'BLACK',
  },
  {
    className: 'border-sky-300 bg-sky-500 text-white',
    label: '藍',
    value: 'BLUE',
  },
  {
    className: 'border-red-300 bg-red-500 text-white',
    label: '紅',
    value: 'RED',
  },
  {
    className: 'border-amber-300 bg-amber-400 text-slate-900',
    label: '黃',
    value: 'YELLOW',
  },
  {
    className: 'border-emerald-300 bg-emerald-500 text-white',
    label: '綠',
    value: 'GREEN',
  },
  {
    className: 'border-slate-300 bg-slate-300 text-slate-900',
    label: '灰',
    value: 'GRAY',
  },
  {
    className: 'border-dashed border-slate-300 bg-background text-foreground',
    label: '其他',
    value: 'OTHER',
  },
] as const satisfies ReadonlyArray<{
  className: string;
  label: string;
  value: AdminWorkOrderBoardColorOption;
}>;

const BOARD_COLOR_BUTTON_BASE_CLASS =
  'h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const BOARD_COLOR_BUTTON_SELECTED_CLASS =
  'border-slate-950 ring-2 ring-slate-950 ring-offset-2 ring-offset-background shadow-[inset_0_0_0_2px_rgba(255,255,255,0.92)]';

export const getAdminWorkOrderCreateBoardColorButtonClassName = (
  optionClassName: string,
  isSelected: boolean,
) =>
  [
    BOARD_COLOR_BUTTON_BASE_CLASS,
    optionClassName,
    isSelected ? BOARD_COLOR_BUTTON_SELECTED_CLASS : '',
  ]
    .filter(Boolean)
    .join(' ');

const createFormSchema = z
  .object({
    boardBrand: z.string().max(80, '品牌不可超過 80 字。'),
    boardLengthClass: z.string(),
    boardColorChoice: z.string(),
    boardColorOther: z.string().max(40, '顏色描述不可超過 40 字。'),
    boardModel: z.string().max(80, '型號不可超過 80 字。'),
    boardSizeLabel: z.string().max(40, '尺寸標記不可超過 40 字。'),
    boardType: z.string(),
    customerModeDecision: z.enum(CUSTOMER_MODE_DECISIONS),
    customerName: z.string().max(80, '顧客姓名不可超過 80 字。'),
    customerPhone: z.string(),
    damageDescription: z.string(),
    estimatedCompletionDate: z.string(),
    initialQuoteAmount: z.string(),
    initialQuoteDescription: z.string().max(160, '報價備註不可超過 160 字。'),
    intakeDate: z.string(),
    internalNote: z.string(),
    paperOrderNo: z.string(),
    paymentReceived: z.boolean(),
    publicNote: z.string(),
    selectedCustomerId: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.paperOrderNo) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入紙本工單號。',
        path: ['paperOrderNo'],
      });
    } else if (value.paperOrderNo.length < 3) {
      ctx.addIssue({
        code: 'custom',
        message: '紙本工單號至少 3 碼。',
        path: ['paperOrderNo'],
      });
    } else if (value.paperOrderNo.length > 50) {
      ctx.addIssue({
        code: 'custom',
        message: '紙本工單號不可超過 50 碼。',
        path: ['paperOrderNo'],
      });
    }

    const normalizedPhone = normalizeTaiwanMobilePhoneInput(value.customerPhone);

    if (!normalizedPhone) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入完整台灣手機號碼。',
        path: ['customerPhone'],
      });
    }

    if (value.customerModeDecision === 'unresolved') {
      ctx.addIssue({
        code: 'custom',
        message: '請先查詢顧客，並選擇既有顧客或建立新顧客。',
        path: ['customerPhone'],
      });
    }

    if (value.customerModeDecision === 'reuse' && !UUID_PATTERN.test(value.selectedCustomerId)) {
      ctx.addIssue({
        code: 'custom',
        message: '請選擇既有顧客。',
        path: ['selectedCustomerId'],
      });
    }

    if (value.customerModeDecision === 'create' && !value.customerName) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入顧客姓名。',
        path: ['customerName'],
      });
    }

    if (!BOARD_TYPES.includes(value.boardType as BoardType)) {
      ctx.addIssue({
        code: 'custom',
        message: '請選擇板型。',
        path: ['boardType'],
      });
    }

    if (value.boardType === 'SURFBOARD') {
      if (!BOARD_LENGTH_CLASSES.includes(value.boardLengthClass as BoardLengthClass)) {
        ctx.addIssue({
          code: 'custom',
          message: '請選擇衝浪板長度分類。',
          path: ['boardLengthClass'],
        });
      }
    } else if (value.boardLengthClass) {
      ctx.addIssue({
        code: 'custom',
        message: '只有衝浪板可以設定長度分類。',
        path: ['boardLengthClass'],
      });
    }

    if (!value.damageDescription) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入損傷描述。',
        path: ['damageDescription'],
      });
    }

    if (!DATE_PATTERN.test(value.intakeDate) || !isValidDateString(value.intakeDate)) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入有效收件日期。',
        path: ['intakeDate'],
      });
    }

    if (
      !DATE_PATTERN.test(value.estimatedCompletionDate) ||
      !isValidDateString(value.estimatedCompletionDate)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '請輸入有效預估完成日。',
        path: ['estimatedCompletionDate'],
      });
    }

    if (
      value.boardColorChoice &&
      !BOARD_COLOR_OPTIONS.includes(value.boardColorChoice as AdminWorkOrderBoardColorOption)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '請選擇有效顏色。',
        path: ['boardColorChoice'],
      });
    }

    if (value.initialQuoteAmount) {
      if (!/^\d+$/.test(value.initialQuoteAmount)) {
        ctx.addIssue({
          code: 'custom',
          message: '初始報價必須是正整數。',
          path: ['initialQuoteAmount'],
        });
      } else if (Number.parseInt(value.initialQuoteAmount, 10) < 1) {
        ctx.addIssue({
          code: 'custom',
          message: '初始報價必須大於 0。',
          path: ['initialQuoteAmount'],
        });
      }
    }
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

const trimValue = (value: string | undefined | null) => value?.trim() ?? '';

const isValidDateString = (value: string) => {
  const date = parseDateStringAsUtc(value);

  return Boolean(date);
};

const parseDateStringAsUtc = (value: string) => {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [yearString, monthString, dayString] = value.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatUtcDateString = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const shouldResetCustomerLookupResolution = (
  lastLookupPhone: string | null,
  nextPhone: string,
) => {
  if (lastLookupPhone === null) {
    return false;
  }

  return normalizeTaiwanMobilePhoneInput(nextPhone) !== lastLookupPhone;
};

export const getTaipeiTodayDateString = (now = new Date()) => {
  const parts = taipeiDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
};

export const getFixedNextSundayDateString = (intakeDate: string) => {
  const parsedDate = parseDateStringAsUtc(intakeDate);

  if (!parsedDate) {
    return '';
  }

  const dayOfWeek = parsedDate.getUTCDay();
  const daysUntilCurrentWeekSunday = (7 - dayOfWeek) % 7;
  const daysToTargetSunday = daysUntilCurrentWeekSunday + 7;

  parsedDate.setUTCDate(parsedDate.getUTCDate() + daysToTargetSunday);

  return formatUtcDateString(parsedDate);
};

export const createAdminWorkOrderCreateInitialFormState = (
  today = getTaipeiTodayDateString(),
): AdminWorkOrderCreateFormState => ({
  boardBrand: '',
  boardLengthClass: '',
  boardColorChoice: '',
  boardColorOther: '',
  boardModel: '',
  boardSizeLabel: '',
  boardType: '',
  customerModeDecision: 'unresolved',
  customerName: '',
  customerPhone: '',
  damageDescription: '',
  estimatedCompletionDate: getFixedNextSundayDateString(today),
  estimatedCompletionDateManuallyEdited: false,
  initialQuoteAmount: '',
  initialQuoteDescription: '',
  intakeDate: today,
  internalNote: '',
  paperOrderNo: '',
  paymentReceived: false,
  publicNote: '',
  selectedCustomerId: '',
});

export const normalizeAdminWorkOrderCreateFormState = (
  formState: AdminWorkOrderCreateFormState,
): AdminWorkOrderCreateNormalizedSnapshot => ({
  boardBrand: trimValue(formState.boardBrand),
  boardLengthClass: formState.boardLengthClass,
  boardColorChoice: formState.boardColorChoice,
  boardColorOther: trimValue(formState.boardColorOther),
  boardModel: trimValue(formState.boardModel),
  boardSizeLabel: trimValue(formState.boardSizeLabel),
  boardType: formState.boardType,
  customerModeDecision: formState.customerModeDecision,
  customerName: trimValue(formState.customerName),
  customerPhone: trimValue(formState.customerPhone),
  damageDescription: trimValue(formState.damageDescription),
  estimatedCompletionDate: trimValue(formState.estimatedCompletionDate),
  initialQuoteAmount: trimValue(formState.initialQuoteAmount),
  initialQuoteDescription: trimValue(formState.initialQuoteDescription),
  intakeDate: trimValue(formState.intakeDate),
  internalNote: trimValue(formState.internalNote),
  paperOrderNo: trimValue(formState.paperOrderNo),
  paymentReceived: formState.paymentReceived,
  publicNote: trimValue(formState.publicNote),
  selectedCustomerId: trimValue(formState.selectedCustomerId),
});

export const hasAdminWorkOrderCreateUnsavedChanges = (
  baseline: AdminWorkOrderCreateNormalizedSnapshot,
  current: AdminWorkOrderCreateNormalizedSnapshot,
) => JSON.stringify(baseline) !== JSON.stringify(current);

export const buildAdminWorkOrderCreatePayload = (
  formState: AdminWorkOrderCreateFormState,
): {
  fieldErrors: Record<string, string[]>;
  payload: AdminWorkOrderCreatePayload | null;
} => {
  const normalized = normalizeAdminWorkOrderCreateFormState(formState);
  const parsedForm = createFormSchema.safeParse(normalized);

  if (!parsedForm.success) {
    return {
      fieldErrors: toFieldErrors(parsedForm.error),
      payload: null,
    };
  }

  const normalizedPhone = normalizeTaiwanMobilePhoneInput(parsedForm.data.customerPhone);

  if (!normalizedPhone) {
    return {
      fieldErrors: {
        customerPhone: ['請輸入完整台灣手機號碼。'],
      },
      payload: null,
    };
  }

  const boardColor =
    parsedForm.data.boardColorChoice === 'OTHER'
      ? trimValue(parsedForm.data.boardColorOther) || undefined
      : parsedForm.data.boardColorChoice || undefined;

  const quoteItems =
    parsedForm.data.initialQuoteAmount === ''
      ? []
      : [
          {
            amount: Number.parseInt(parsedForm.data.initialQuoteAmount, 10),
            description: parsedForm.data.initialQuoteDescription || '初始報價',
            itemType: 'INITIAL' as const,
          },
        ];

  const payload: AdminWorkOrderCreatePayload = {
    board: {
      boardType: parsedForm.data.boardType as BoardType,
    },
    customerMode: parsedForm.data.customerModeDecision as 'create' | 'reuse',
    quoteItems,
    workOrder: {
      damageDescription: parsedForm.data.damageDescription,
      estimatedCompletionDate: parsedForm.data.estimatedCompletionDate,
      intakeDate: parsedForm.data.intakeDate,
      paperOrderNo: parsedForm.data.paperOrderNo,
      paymentReceived: parsedForm.data.paymentReceived,
    },
  };

  if (parsedForm.data.customerModeDecision === 'create') {
    payload.customer = {
      name: parsedForm.data.customerName,
      phone: normalizedPhone,
    };
  }

  if (parsedForm.data.customerModeDecision === 'reuse') {
    payload.customerId = parsedForm.data.selectedCustomerId;
  }

  if (parsedForm.data.boardBrand) {
    payload.board.brand = parsedForm.data.boardBrand;
  }

  if (parsedForm.data.boardType === 'SURFBOARD' && parsedForm.data.boardLengthClass) {
    payload.board.boardLengthClass = parsedForm.data.boardLengthClass as BoardLengthClass;
  }

  if (boardColor) {
    payload.board.color = boardColor;
  }

  if (parsedForm.data.boardModel) {
    payload.board.model = parsedForm.data.boardModel;
  }

  if (parsedForm.data.boardSizeLabel) {
    payload.board.sizeLabel = parsedForm.data.boardSizeLabel;
  }

  if (parsedForm.data.internalNote) {
    payload.workOrder.internalNote = parsedForm.data.internalNote;
  }

  if (parsedForm.data.publicNote) {
    payload.workOrder.publicNote = parsedForm.data.publicNote;
  }

  return {
    fieldErrors: {},
    payload,
  };
};
