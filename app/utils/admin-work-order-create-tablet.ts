import type { AdminWorkOrderCreateFormState } from './admin-work-order-create';
import { normalizeTaiwanMobilePhoneInput } from './phone';

type BoardLengthClass = AdminWorkOrderCreateFormState['boardLengthClass'];

export const BOARD_SIZE_QUICK_OPTIONS = {
  SHORTBOARD: ["5'5", "5'6", "5'8", "5'10", "6'0", "6'2", "6'4"],
  MID_LENGTH: ["6'8", "6'10", "7'0", "7'2", "7'4", "8'0"],
  LONGBOARD: ["8'8", "8'10", "9'0", "9'2", "9'4", "9'6"],
} as const satisfies Record<Exclude<BoardLengthClass, ''>, readonly string[]>;

export const ESTIMATED_COMPLETION_DATE_QUICK_ACTIONS = [
  { label: '今天', offsetDays: 0 },
  { label: '+3 天', offsetDays: 3 },
  { label: '+5 天', offsetDays: 5 },
  { label: '+7 天', offsetDays: 7 },
  { label: '+14 天', offsetDays: 14 },
] as const;

export const INITIAL_QUOTE_QUICK_AMOUNTS = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000] as const;

export const INITIAL_QUOTE_ADJUSTMENTS = [1000, -1000, 100, -100, 10, -10] as const;

export const DAMAGE_DESCRIPTION_QUICK_CHIPS = [
  '鼻頭傷',
  '尾部傷',
  '側邊裂',
  '中段凹陷',
  '進水',
  '脫層',
  'Fin座損壞',
  '多處小傷',
] as const;

export const REPAIR_SPOT_QUICK_OPTIONS = [
  { label: '1 處', value: 1 },
  { label: '2 處', value: 2 },
  { label: '3 處', value: 3 },
  { label: '4 處', value: 4 },
  { label: '5 處', value: 5 },
  { label: '多處', value: 'many' },
] as const;

export const PUBLIC_NOTE_QUICK_CHIPS = [
  '已收件，等待評估',
  '需先除濕後確認報價',
  '維修完成後會通知取件',
  '實際完成時間依現場狀況調整',
] as const;

export const INTERNAL_NOTE_QUICK_CHIPS = [
  '老闆確認',
  '需拍照',
  '先報價',
  '客人急件',
  '需追加確認',
  '等材料',
] as const;

export interface RequiredFieldSummary {
  completed: number;
  missingLabels: string[];
  total: number;
}

const BOARD_SIZE_PATTERN = /^\s*(\d+)\s*'\s*(\d{1,2})\s*"?\s*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPAIR_SPOT_PATTERN = /維修處數量：(多處|\d+處)/;

const trimValue = (value: string | null | undefined) => value?.trim() ?? '';

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

export const getBoardSizeQuickOptions = (boardLengthClass: BoardLengthClass) => {
  if (!boardLengthClass) {
    return [];
  }

  return BOARD_SIZE_QUICK_OPTIONS[boardLengthClass] ?? [];
};

export const parseBoardSizeInches = (value: string) => {
  const match = BOARD_SIZE_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const feet = Number(match[1]);
  const inches = Number(match[2]);

  if (
    !Number.isInteger(feet) ||
    !Number.isInteger(inches) ||
    feet < 1 ||
    inches < 0 ||
    inches > 11
  ) {
    return null;
  }

  return feet * 12 + inches;
};

export const formatBoardSizeInches = (totalInches: number) => {
  if (!Number.isInteger(totalInches) || totalInches < 1) {
    return null;
  }

  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  if (feet < 1) {
    return null;
  }

  return `${feet}'${inches}`;
};

export const adjustBoardSizeLabel = (value: string, deltaInches: number) => {
  const totalInches = parseBoardSizeInches(value);

  if (totalInches === null) {
    return null;
  }

  return formatBoardSizeInches(totalInches + deltaInches);
};

export const getEstimatedCompletionDateQuickValue = (today: string, offsetDays: number) => {
  const parsedDate = parseDateStringAsUtc(today);

  if (!parsedDate) {
    return '';
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + offsetDays);

  return formatUtcDateString(parsedDate);
};

export const sanitizeNumericInput = (value: string | number | null | undefined) =>
  String(value ?? '').replaceAll(/\D/g, '');

export const adjustInitialQuoteAmount = (value: string, deltaAmount: number) => {
  const currentAmount = Number.parseInt(sanitizeNumericInput(value) || '0', 10);
  const nextAmount = Math.max(0, currentAmount + deltaAmount);

  return nextAmount === 0 ? '' : String(nextAmount);
};

export const appendDelimitedText = (currentValue: string, nextText: string, delimiter = '、') => {
  const current = trimValue(currentValue);
  const next = trimValue(nextText);

  if (!next) {
    return currentValue;
  }

  const existingItems = current
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);

  if (existingItems.includes(next)) {
    return currentValue;
  }

  return current ? `${current}${delimiter}${next}` : next;
};

export const appendLineText = (currentValue: string, nextText: string) => {
  const current = trimValue(currentValue);
  const next = trimValue(nextText);

  if (!next) {
    return currentValue;
  }

  const existingLines = current
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (existingLines.includes(next)) {
    return currentValue;
  }

  return current ? `${current}\n${next}` : next;
};

export const formatRepairSpotText = (value: number | 'many') => {
  if (value === 'many') {
    return '維修處數量：多處';
  }

  return `維修處數量：${Math.max(1, Math.floor(value))}處`;
};

export const getRepairSpotCount = (currentValue: string) => {
  const match = REPAIR_SPOT_PATTERN.exec(currentValue);

  if (!match) {
    return null;
  }

  const rawCount = match[1];

  if (!rawCount) {
    return null;
  }

  if (rawCount === '多處') {
    return 'many' as const;
  }

  const count = Number.parseInt(rawCount.replace('處', ''), 10);

  return Number.isInteger(count) && count >= 1 ? count : null;
};

export const setRepairSpotCount = (currentValue: string, value: number | 'many') => {
  const current = trimValue(currentValue);
  const nextText = formatRepairSpotText(value);

  if (REPAIR_SPOT_PATTERN.test(current)) {
    return current.replace(REPAIR_SPOT_PATTERN, nextText);
  }

  return appendDelimitedText(current, nextText);
};

export const adjustRepairSpotCount = (currentValue: string, deltaCount: number) => {
  const currentCount = getRepairSpotCount(currentValue);
  const numericCount = typeof currentCount === 'number' ? currentCount : 0;
  const nextCount = Math.max(1, numericCount + deltaCount);

  return setRepairSpotCount(currentValue, nextCount);
};

export const getRequiredFieldSummary = (
  formState: AdminWorkOrderCreateFormState,
): RequiredFieldSummary => {
  const requiredFields: Array<{ complete: boolean; label: string }> = [
    { complete: trimValue(formState.paperOrderNo).length > 0, label: '工單號碼' },
    {
      complete: normalizeTaiwanMobilePhoneInput(formState.customerPhone) !== null,
      label: '顧客手機',
    },
    {
      complete:
        formState.customerModeDecision === 'create' || formState.customerModeDecision === 'reuse',
      label: '顧客查詢',
    },
    {
      complete:
        formState.customerModeDecision === 'create'
          ? trimValue(formState.customerName).length > 0
          : formState.customerModeDecision === 'reuse'
            ? trimValue(formState.selectedCustomerId).length > 0
            : false,
      label: formState.customerModeDecision === 'reuse' ? '選擇顧客' : '顧客姓名',
    },
    { complete: trimValue(formState.boardType).length > 0, label: '板型' },
    { complete: trimValue(formState.damageDescription).length > 0, label: '損傷描述' },
    { complete: DATE_PATTERN.test(trimValue(formState.intakeDate)), label: '收件日期' },
    {
      complete: DATE_PATTERN.test(trimValue(formState.estimatedCompletionDate)),
      label: '預估完成日',
    },
    {
      complete:
        formState.repairCountSource === 'manual'
          ? trimValue(formState.repairCount).length > 0
          : formState.repairMarks.length > 0,
      label: '維修處數',
    },
  ];

  if (formState.boardType === 'SURFBOARD') {
    requiredFields.splice(5, 0, {
      complete: trimValue(formState.boardLengthClass).length > 0,
      label: '長度分類',
    });
  }

  const missingLabels = requiredFields
    .filter((field) => !field.complete)
    .map((field) => field.label);

  return {
    completed: requiredFields.length - missingLabels.length,
    missingLabels,
    total: requiredFields.length,
  };
};
