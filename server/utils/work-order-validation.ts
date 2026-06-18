import { ValidationError, type FieldErrors } from './api-errors';
import { normalizeTaiwanMobilePhone } from './phone';
import type { Database } from '../../types/database.types';

export const STALE_RECEIVED_DAYS = 7;

export const WORK_ORDER_LIST_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'intake_date',
  'estimated_completion_date',
  'current_status',
  'paper_order_no',
  'quote_total_amount',
] as const;

const BOARD_TYPES = ['SURFBOARD', 'SUP', 'SNOWBOARD'] as const;
const BOARD_LENGTH_CLASSES = ['SHORTBOARD', 'MID_LENGTH', 'LONGBOARD'] as const;
const REPAIR_COUNT_SOURCES = ['auto', 'manual'] as const;
const REPAIR_MARK_BOARD_SIDES = ['front', 'back'] as const;
const QUOTE_ITEM_TYPES = ['INITIAL', 'ADDITIONAL', 'ADJUSTMENT'] as const;
const WORK_ORDER_STATUSES = [
  'RECEIVED',
  'DRYING',
  'REPAIRING',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CANCELLED',
] as const;

const PATCH_ALLOWED_FIELDS = [
  'estimatedCompletionDate',
  'damageDescription',
  'paymentReceived',
  'repairCount',
  'repairCountSource',
  'repairMarks',
  'publicNote',
  'internalNote',
  'pickupNote',
  'storageFeeWarningAfterDays',
] as const;

const BULK_STATUS_ALLOWED_FIELDS = ['paperOrderNos', 'status', 'note'] as const;
const PUBLIC_WORK_ORDER_LOOKUP_ALLOWED_FIELDS = ['paperOrderNo', 'phone'] as const;
const ADMIN_WORK_ORDER_SCAN_LOOKUP_ALLOWED_QUERY_FIELDS = ['code'] as const;
const ADMIN_WORK_ORDER_SCAN_QUICK_NOTE_ALLOWED_FIELDS = ['note'] as const;
const STATUS_TRANSITION_ALLOWED_FIELDS = ['status', 'note', 'internalNote'] as const;
const NEXT_PAPER_ORDER_NO_ALLOWED_QUERY_FIELDS = ['mode'] as const;
const PAPER_ORDER_MODES = ['standard', 'test'] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type BoardType = Database['public']['Enums']['board_type'];
export type BoardLengthClass = Database['public']['Enums']['board_length_class'];
export type QuoteItemType = Database['public']['Enums']['quote_item_type'];
export type RepairCountSource = Database['public']['Enums']['repair_count_source'];
export type RepairMarkBoardSide = Database['public']['Enums']['repair_mark_board_side'];
export type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
export type WorkOrderListSortField = (typeof WORK_ORDER_LIST_SORT_FIELDS)[number];
export type PaperOrderMode = (typeof PAPER_ORDER_MODES)[number];

export interface CustomerLookupQuery {
  normalizedPhone: string;
}

export interface PaperOrderResolveQuery {
  paperOrderNo: string;
}

export interface AdminWorkOrderScanLookupQuery {
  code: string;
}

export interface PublicWorkOrderLookupInput {
  normalizedPhone: string;
  paperOrderNo: string;
}

export interface WorkOrderListQuery {
  customerPhone?: string;
  filters: {
    overdueEstimatedCompletion?: boolean;
    pickupOverdue?: boolean;
    staleReceived?: boolean;
    status?: WorkOrderStatus;
  };
  page: number;
  pageSize: number;
  q?: string;
  sort: {
    direction: 'asc' | 'desc';
    field: WorkOrderListSortField;
  };
  staleReceivedBefore: string;
}

export interface CreateWorkOrderInput {
  board: {
    boardLengthClass?: BoardLengthClass | null;
    boardType: BoardType;
    brand?: string | null;
    color?: string | null;
    model?: string | null;
    serialLabel?: string | null;
    sizeLabel?: string | null;
  };
  customer?: {
    name: string;
    note?: string | null;
    phone: string;
  };
  customerId?: string;
  customerMode: 'create' | 'reuse';
  paperOrderMode?: PaperOrderMode;
  quoteItems: Array<{
    amount: number;
    description: string;
    itemType: QuoteItemType;
  }>;
  repairMarks: Array<{
    boardSide: RepairMarkBoardSide;
    heightRatio: number;
    sortOrder: number;
    templateKey: string;
    widthRatio: number;
    xRatio: number;
    yRatio: number;
  }>;
  workOrder: {
    damageDescription?: string | null;
    estimatedCompletionDate?: string | null;
    intakeDate: string;
    internalNote?: string | null;
    paperOrderNo?: string;
    paymentReceived: boolean;
    publicNote?: string | null;
    repairCount?: number | null;
    repairCountSource?: RepairCountSource;
  };
}

export interface NextPaperOrderNoQuery {
  mode: PaperOrderMode;
}

export interface PatchWorkOrderInput {
  damageDescription?: string | null;
  estimatedCompletionDate?: string | null;
  internalNote?: string | null;
  paymentReceived?: boolean;
  pickupNote?: string | null;
  publicNote?: string | null;
  repairCount?: number | null;
  repairCountSource?: RepairCountSource;
  repairMarks?: Array<{
    boardSide: RepairMarkBoardSide;
    heightRatio: number;
    sortOrder: number;
    templateKey: string;
    widthRatio: number;
    xRatio: number;
    yRatio: number;
  }>;
  storageFeeWarningAfterDays?: number;
}

export interface BulkStatusInput {
  note?: string | null;
  paperOrderNos: string[];
  requestedCount: number;
  status: WorkOrderStatus;
}

export interface StatusTransitionInput {
  hasInternalNote: boolean;
  internalNote?: string | null;
  note?: string | null;
  status: WorkOrderStatus;
}

export interface AdminWorkOrderScanQuickNoteInput {
  note: string;
}

type ErrorCollector = FieldErrors;

const addError = (errors: ErrorCollector, field: string, message: string) => {
  errors[field] ??= [];
  errors[field].push(message);
};

const assertNoErrors = (errors: ErrorCollector) => {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const getSingleQueryValue = (
  query: Record<string, unknown>,
  field: string,
  errors: ErrorCollector,
): string | undefined => {
  const value = query[field];

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    addError(errors, field, 'Only one value is allowed.');
    return undefined;
  }

  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string.');
    return undefined;
  }

  return value;
};

const parseBooleanQuery = (
  query: Record<string, unknown>,
  field: string,
  errors: ErrorCollector,
): boolean | undefined => {
  const value = getSingleQueryValue(query, field, errors);

  if (value === undefined || value === '') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  addError(errors, field, 'Must be true or false.');
  return undefined;
};

const parsePositiveInteger = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    addError(errors, field, 'Must be a positive integer.');
    return undefined;
  }

  const stringValue = String(value);

  if (!/^\d+$/.test(stringValue)) {
    addError(errors, field, 'Must be a positive integer.');
    return undefined;
  }

  const parsedValue = Number.parseInt(stringValue, 10);

  if (parsedValue < 1) {
    addError(errors, field, 'Must be greater than 0.');
    return undefined;
  }

  return parsedValue;
};

const parseRequiredString = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { maxLength?: number; minLength?: number } = {},
): string | undefined => {
  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string.');
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    addError(errors, field, 'Is required.');
    return undefined;
  }

  if (options.minLength && trimmedValue.length < options.minLength) {
    addError(errors, field, `Must be at least ${options.minLength} characters.`);
  }

  if (options.maxLength && trimmedValue.length > options.maxLength) {
    addError(errors, field, `Must be at most ${options.maxLength} characters.`);
  }

  return trimmedValue;
};

const parseOptionalString = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { maxLength?: number } = {},
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string or null.');
    return undefined;
  }

  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue || null;

  if (normalizedValue && options.maxLength && normalizedValue.length > options.maxLength) {
    addError(errors, field, `Must be at most ${options.maxLength} characters.`);
  }

  return normalizedValue;
};

const parseDateString = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { nullable?: boolean; required?: boolean } = {},
): string | null | undefined => {
  if (value === undefined) {
    if (options.required) {
      addError(errors, field, 'Is required.');
    }

    return undefined;
  }

  if (value === null && options.nullable) {
    return null;
  }

  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    addError(errors, field, 'Must be a YYYY-MM-DD date string.');
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    addError(errors, field, 'Must be a valid date.');
    return undefined;
  }

  return value;
};

const parseBoolean = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { defaultValue?: boolean; required?: boolean } = {},
): boolean | undefined => {
  if (value === undefined) {
    if (options.required) {
      addError(errors, field, 'Is required.');
      return undefined;
    }

    return options.defaultValue;
  }

  if (typeof value !== 'boolean') {
    addError(errors, field, 'Must be a boolean.');
    return undefined;
  }

  return value;
};

const parseInteger = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    addError(errors, field, 'Must be an integer.');
    return undefined;
  }

  return value;
};

const parseNullablePositiveInteger = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parsePositiveInteger(value, field, errors);
};

const parseRatio = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { allowZero?: boolean } = {},
): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    addError(errors, field, 'Must be a number.');
    return undefined;
  }

  const lowerBoundValid = options.allowZero ? value >= 0 : value > 0;

  if (!lowerBoundValid || value > 1) {
    addError(
      errors,
      field,
      options.allowZero
        ? 'Must be between 0 and 1.'
        : 'Must be greater than 0 and less than or equal to 1.',
    );
    return undefined;
  }

  return value;
};

const parseEnum = <Value extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly Value[],
  errors: ErrorCollector,
): Value | undefined => {
  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string.');
    return undefined;
  }

  if (!allowedValues.includes(value as Value)) {
    addError(errors, field, `Must be one of: ${allowedValues.join(', ')}.`);
    return undefined;
  }

  return value as Value;
};

const parseUuidValue = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): string | undefined => {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    addError(errors, field, 'Must be a valid UUID.');
    return undefined;
  }

  return value;
};

const parseRepairMarkArray = (
  value: unknown,
  field: string,
  boardType: BoardType | null,
  errors: ErrorCollector,
) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    addError(errors, field, 'Must be an array.');
    return undefined;
  }

  return value
    .map((entry, index) => {
      const entryField = `${field}.${index}`;

      if (!isRecord(entry)) {
        addError(errors, entryField, 'Must be an object.');
        return {
          boardSide: 'front' as RepairMarkBoardSide,
          heightRatio: 0.1,
          sortOrder: index,
          templateKey: '',
          widthRatio: 0.1,
          xRatio: 0.5,
          yRatio: 0.5,
        };
      }

      return {
        boardSide:
          parseEnum(
            entry.boardSide,
            `${entryField}.boardSide`,
            REPAIR_MARK_BOARD_SIDES,
            errors,
          ) ?? 'front',
        heightRatio:
          parseRatio(entry.heightRatio, `${entryField}.heightRatio`, errors) ?? 0.1,
        sortOrder: parseInteger(entry.sortOrder, `${entryField}.sortOrder`, errors) ?? index,
        templateKey:
          parseRequiredString(entry.templateKey, `${entryField}.templateKey`, errors, {
            maxLength: 80,
            minLength: 3,
          }) ?? '',
        widthRatio:
          parseRatio(entry.widthRatio, `${entryField}.widthRatio`, errors) ?? 0.1,
        xRatio:
          parseRatio(entry.xRatio, `${entryField}.xRatio`, errors, { allowZero: true }) ?? 0.5,
        yRatio:
          parseRatio(entry.yRatio, `${entryField}.yRatio`, errors, { allowZero: true }) ?? 0.5,
      };
    })
    .map((mark, index) => {
      if (!boardType) {
        return mark;
      }

      const expectedTemplate = `${boardType}:${mark.boardSide}:v1`;

      if (mark.templateKey !== expectedTemplate) {
        addError(
          errors,
          `${field}.${index}.templateKey`,
          `Must match ${expectedTemplate}.`,
        );
      }

      if (mark.sortOrder < 0) {
        addError(errors, `${field}.${index}.sortOrder`, 'Must be greater than or equal to 0.');
      }

      return mark;
    });
};

export const parseUuid = (value: unknown, field: string): string => {
  const errors: ErrorCollector = {};
  const parsedValue = parseUuidValue(value, field, errors);

  assertNoErrors(errors);
  return parsedValue as string;
};

const parsePaperOrderNoValue = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): string | undefined =>
  parseRequiredString(value, field, errors, {
    maxLength: 50,
    minLength: 3,
  });

export const parsePaperOrderResolveQuery = (
  query: Record<string, unknown>,
): PaperOrderResolveQuery => {
  const errors: ErrorCollector = {};
  const paperOrderNoValue = getSingleQueryValue(query, 'paperOrderNo', errors);
  const paperOrderNo =
    paperOrderNoValue === undefined
      ? undefined
      : parsePaperOrderNoValue(paperOrderNoValue, 'paperOrderNo', errors);

  if (paperOrderNoValue === undefined) {
    addError(errors, 'paperOrderNo', 'Is required.');
  }

  assertNoErrors(errors);

  return { paperOrderNo: paperOrderNo as string };
};

export const parseAdminWorkOrderScanLookupQuery = (
  query: Record<string, unknown>,
): AdminWorkOrderScanLookupQuery => {
  const errors: ErrorCollector = {};
  const unknownFields = Object.keys(query).filter(
    (field) =>
      !ADMIN_WORK_ORDER_SCAN_LOOKUP_ALLOWED_QUERY_FIELDS.includes(
        field as (typeof ADMIN_WORK_ORDER_SCAN_LOOKUP_ALLOWED_QUERY_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const codeValue = getSingleQueryValue(query, 'code', errors);
  const code = codeValue === undefined ? undefined : parsePaperOrderNoValue(codeValue, 'code', errors);

  if (codeValue === undefined) {
    addError(errors, 'code', 'Is required.');
  }

  assertNoErrors(errors);

  return { code: code as string };
};

export const parseCustomerLookupQuery = (query: Record<string, unknown>): CustomerLookupQuery => {
  const errors: ErrorCollector = {};
  const phone = getSingleQueryValue(query, 'phone', errors);
  const normalizedPhone = normalizeTaiwanMobilePhone(phone);

  if (!normalizedPhone) {
    addError(errors, 'phone', 'Must be a Taiwan mobile phone number.');
  }

  assertNoErrors(errors);

  return { normalizedPhone: normalizedPhone as string };
};

export const parsePublicWorkOrderLookupBody = (body: unknown): PublicWorkOrderLookupInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !PUBLIC_WORK_ORDER_LOOKUP_ALLOWED_FIELDS.includes(
        field as (typeof PUBLIC_WORK_ORDER_LOOKUP_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const paperOrderNo = hasOwn(body, 'paperOrderNo')
    ? parsePaperOrderNoValue(body.paperOrderNo, 'paperOrderNo', errors)
    : undefined;

  if (!hasOwn(body, 'paperOrderNo')) {
    addError(errors, 'paperOrderNo', 'Is required.');
  }

  const normalizedPhone = normalizeTaiwanMobilePhone(body.phone);

  if (!hasOwn(body, 'phone')) {
    addError(errors, 'phone', 'Is required.');
  } else if (!normalizedPhone) {
    addError(errors, 'phone', 'Must be a Taiwan mobile phone number.');
  }

  assertNoErrors(errors);

  return {
    normalizedPhone: normalizedPhone as string,
    paperOrderNo: paperOrderNo as string,
  };
};

export const parseWorkOrderListQuery = (
  query: Record<string, unknown>,
  now = new Date(),
): WorkOrderListQuery => {
  const errors: ErrorCollector = {};
  const pageValue = getSingleQueryValue(query, 'page', errors);
  const pageSizeValue = getSingleQueryValue(query, 'pageSize', errors);
  const qValue = getSingleQueryValue(query, 'q', errors);
  const customerPhoneValue = getSingleQueryValue(query, 'customerPhone', errors);
  const statusValue = getSingleQueryValue(query, 'status', errors);
  const sortValue = getSingleQueryValue(query, 'sort', errors);
  const page = pageValue ? parsePositiveInteger(pageValue, 'page', errors) : 1;
  const parsedPageSize = pageSizeValue
    ? parsePositiveInteger(pageSizeValue, 'pageSize', errors)
    : 20;
  const pageSize = parsedPageSize && parsedPageSize > 100 ? undefined : parsedPageSize;
  const filters: WorkOrderListQuery['filters'] = {};

  if (parsedPageSize && parsedPageSize > 100) {
    addError(errors, 'pageSize', 'Must be less than or equal to 100.');
  }

  if (statusValue !== undefined && statusValue !== '') {
    filters.status = parseEnum(statusValue, 'status', WORK_ORDER_STATUSES, errors);
  }

  const normalizedCustomerPhone =
    customerPhoneValue === undefined || customerPhoneValue === ''
      ? undefined
      : normalizeTaiwanMobilePhone(customerPhoneValue);

  if (customerPhoneValue && !normalizedCustomerPhone) {
    addError(errors, 'customerPhone', 'Must be a Taiwan mobile phone number.');
  }

  filters.overdueEstimatedCompletion = parseBooleanQuery(
    query,
    'overdueEstimatedCompletion',
    errors,
  );
  filters.pickupOverdue = parseBooleanQuery(query, 'pickupOverdue', errors);
  filters.staleReceived = parseBooleanQuery(query, 'staleReceived', errors);

  let sort: WorkOrderListQuery['sort'] = {
    direction: 'desc',
    field: 'created_at',
  };

  if (sortValue) {
    const [field, direction, extra] = sortValue.split(':');

    if (
      extra ||
      !WORK_ORDER_LIST_SORT_FIELDS.includes(field as WorkOrderListSortField) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      addError(
        errors,
        'sort',
        `Must be field:asc or field:desc using one of: ${WORK_ORDER_LIST_SORT_FIELDS.join(', ')}.`,
      );
    } else {
      sort = {
        direction,
        field: field as WorkOrderListSortField,
      };
    }
  }

  const staleReceivedBefore = new Date(
    now.getTime() - STALE_RECEIVED_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  assertNoErrors(errors);

  return {
    customerPhone: normalizedCustomerPhone ?? undefined,
    filters,
    page: page as number,
    pageSize: pageSize as number,
    q: qValue?.trim() || undefined,
    sort,
    staleReceivedBefore,
  };
};

export const parseCreateWorkOrderBody = (body: unknown): CreateWorkOrderInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const customerMode = parseEnum(
    body.customerMode,
    'customerMode',
    ['create', 'reuse'] as const,
    errors,
  );
  const paperOrderMode =
    body.paperOrderMode === undefined
      ? 'standard'
      : parseEnum(body.paperOrderMode, 'paperOrderMode', PAPER_ORDER_MODES, errors);
  const board = isRecord(body.board) ? body.board : undefined;
  const workOrder = isRecord(body.workOrder) ? body.workOrder : undefined;

  if (!board) {
    addError(errors, 'board', 'Is required.');
  }

  if (!workOrder) {
    addError(errors, 'workOrder', 'Is required.');
  }

  const parsedInput: CreateWorkOrderInput = {
    board: {
      boardLengthClass: null,
      boardType: 'SURFBOARD',
    },
    customerMode: customerMode ?? 'create',
    paperOrderMode: paperOrderMode ?? 'standard',
    quoteItems: [],
    repairMarks: [],
    workOrder: {
      intakeDate: '',
      paymentReceived: false,
      repairCountSource: 'auto',
    },
  };

  if (customerMode === 'create') {
    if (hasOwn(body, 'customerId')) {
      addError(errors, 'customerId', 'Must not be present when customerMode is create.');
    }

    if (!isRecord(body.customer)) {
      addError(errors, 'customer', 'Is required when customerMode is create.');
    } else {
      const normalizedPhone = normalizeTaiwanMobilePhone(body.customer.phone);
      const name = parseRequiredString(body.customer.name, 'customer.name', errors, {
        maxLength: 80,
      });

      if (!normalizedPhone) {
        addError(errors, 'customer.phone', 'Must be a Taiwan mobile phone number.');
      }

      parsedInput.customer = {
        name: name ?? '',
        note: parseOptionalString(body.customer.note, 'customer.note', errors),
        phone: normalizedPhone ?? '',
      };
    }
  }

  if (customerMode === 'reuse') {
    if (hasOwn(body, 'customer')) {
      addError(errors, 'customer', 'Must not be present when customerMode is reuse.');
    }

    parsedInput.customerId = parseUuidValue(body.customerId, 'customerId', errors);
  }

  if (board) {
    parsedInput.board = {
      boardLengthClass:
        board.boardLengthClass === undefined
          ? undefined
          : board.boardLengthClass === null
            ? null
            : parseEnum(
                board.boardLengthClass,
                'board.boardLengthClass',
                BOARD_LENGTH_CLASSES,
                errors,
              ),
      boardType: parseEnum(board.boardType, 'board.boardType', BOARD_TYPES, errors) ?? 'SURFBOARD',
      brand: parseOptionalString(board.brand, 'board.brand', errors, { maxLength: 80 }),
      color: parseOptionalString(board.color, 'board.color', errors, { maxLength: 40 }),
      model: parseOptionalString(board.model, 'board.model', errors, { maxLength: 80 }),
      serialLabel: parseOptionalString(board.serialLabel, 'board.serialLabel', errors, {
        maxLength: 80,
      }),
      sizeLabel: parseOptionalString(board.sizeLabel, 'board.sizeLabel', errors, {
        maxLength: 40,
      }),
    };

    if (parsedInput.board.boardType === 'SURFBOARD') {
      if (!parsedInput.board.boardLengthClass) {
        addError(errors, 'board.boardLengthClass', 'Is required for SURFBOARD.');
      }
    } else if (
      parsedInput.board.boardLengthClass !== undefined &&
      parsedInput.board.boardLengthClass !== null
    ) {
      addError(
        errors,
        'board.boardLengthClass',
        'Can only be set when board.boardType is SURFBOARD.',
      );
    }
  }

  if (workOrder) {
    if (paperOrderMode !== 'test' && hasOwn(workOrder, 'paperOrderNo')) {
      addError(errors, 'workOrder.paperOrderNo', 'Is generated by the server.');
    }

    const testPaperOrderNo =
      paperOrderMode === 'test'
        ? parseRequiredString(workOrder.paperOrderNo, 'workOrder.paperOrderNo', errors, {
            maxLength: 50,
          })
        : undefined;

    if (testPaperOrderNo && !/^99[0-9]{4,}$/.test(testPaperOrderNo)) {
      addError(
        errors,
        'workOrder.paperOrderNo',
        'Must start with 99 and include at least four sequence digits.',
      );
    }

    parsedInput.workOrder = {
      damageDescription: parseOptionalString(
        workOrder.damageDescription,
        'workOrder.damageDescription',
        errors,
      ),
      estimatedCompletionDate: parseDateString(
        workOrder.estimatedCompletionDate,
        'workOrder.estimatedCompletionDate',
        errors,
        { nullable: true },
      ),
      intakeDate:
        parseDateString(workOrder.intakeDate, 'workOrder.intakeDate', errors, {
          required: true,
        }) ?? '',
      internalNote: parseOptionalString(workOrder.internalNote, 'workOrder.internalNote', errors),
      paperOrderNo: testPaperOrderNo,
      paymentReceived:
        parseBoolean(workOrder.paymentReceived, 'workOrder.paymentReceived', errors, {
          defaultValue: false,
        }) ?? false,
      publicNote: parseOptionalString(workOrder.publicNote, 'workOrder.publicNote', errors),
      repairCount: parseNullablePositiveInteger(
        workOrder.repairCount,
        'workOrder.repairCount',
        errors,
      ),
      repairCountSource:
        workOrder.repairCountSource === undefined
          ? undefined
          : parseEnum(
              workOrder.repairCountSource,
              'workOrder.repairCountSource',
              REPAIR_COUNT_SOURCES,
              errors,
            ),
    };
  }

  if (hasOwn(body, 'repairMarks')) {
    parsedInput.repairMarks =
      parseRepairMarkArray(body.repairMarks, 'repairMarks', parsedInput.board.boardType, errors) ??
      [];
  }

  if (body.quoteItems !== undefined) {
    if (!Array.isArray(body.quoteItems)) {
      addError(errors, 'quoteItems', 'Must be an array.');
    } else {
      parsedInput.quoteItems = body.quoteItems.map((quoteItem, index) => {
        const fieldPrefix = `quoteItems.${index}`;

        if (!isRecord(quoteItem)) {
          addError(errors, fieldPrefix, 'Must be an object.');
          return {
            amount: 0,
            description: '',
            itemType: 'ADDITIONAL' as QuoteItemType,
          };
        }

        return {
          amount: parseInteger(quoteItem.amount, `${fieldPrefix}.amount`, errors) ?? 0,
          description:
            parseRequiredString(quoteItem.description, `${fieldPrefix}.description`, errors, {
              maxLength: 160,
            }) ?? '',
          itemType:
            parseEnum(quoteItem.itemType, `${fieldPrefix}.itemType`, QUOTE_ITEM_TYPES, errors) ??
            'ADDITIONAL',
        };
      });

      const initialQuoteCount = parsedInput.quoteItems.filter(
        (quoteItem) => quoteItem.itemType === 'INITIAL',
      ).length;

      if (initialQuoteCount > 1) {
        addError(errors, 'quoteItems', 'Only one INITIAL quote item is allowed.');
      }
    }
  }

  if (parsedInput.workOrder.repairCountSource === 'manual') {
    if (parsedInput.workOrder.repairCount === undefined || parsedInput.workOrder.repairCount === null) {
      addError(errors, 'workOrder.repairCount', 'Is required when repairCountSource is manual.');
    }
  }

  if (
    parsedInput.workOrder.repairCountSource !== 'manual' &&
    parsedInput.workOrder.repairCount !== undefined &&
    parsedInput.workOrder.repairCount !== null &&
    parsedInput.workOrder.repairCount !== parsedInput.repairMarks.length
  ) {
    addError(
      errors,
      'workOrder.repairCount',
      'Must match repairMarks length when repairCountSource is auto.',
    );
  }

  const resolvedRepairCount =
    parsedInput.workOrder.repairCountSource === 'manual'
      ? (parsedInput.workOrder.repairCount ?? null)
      : parsedInput.repairMarks.length > 0
        ? parsedInput.repairMarks.length
        : null;

  if (resolvedRepairCount === null) {
    addError(
      errors,
      'workOrder.repairCount',
      'Is required before creating a work order label.',
    );
  }

  assertNoErrors(errors);

  return parsedInput;
};

export const parseNextPaperOrderNoQuery = (query: Record<string, unknown>): NextPaperOrderNoQuery => {
  const errors: ErrorCollector = {};
  const unknownFields = Object.keys(query).filter(
    (field) =>
      !NEXT_PAPER_ORDER_NO_ALLOWED_QUERY_FIELDS.includes(
        field as (typeof NEXT_PAPER_ORDER_NO_ALLOWED_QUERY_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Unknown field.');
  }

  const modeValue = getSingleQueryValue(query, 'mode', errors);
  const mode =
    modeValue === undefined
      ? 'standard'
      : parseEnum(modeValue, 'mode', PAPER_ORDER_MODES, errors);

  assertNoErrors(errors);

  return { mode: mode as PaperOrderMode };
};

export const parsePatchWorkOrderBody = (body: unknown): PatchWorkOrderInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) => !PATCH_ALLOWED_FIELDS.includes(field as (typeof PATCH_ALLOWED_FIELDS)[number]),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be updated by this endpoint.');
  }

  const patch: PatchWorkOrderInput = {};

  if (hasOwn(body, 'estimatedCompletionDate')) {
    patch.estimatedCompletionDate = parseDateString(
      body.estimatedCompletionDate,
      'estimatedCompletionDate',
      errors,
      { nullable: true },
    );
  }

  if (hasOwn(body, 'damageDescription')) {
    patch.damageDescription = parseOptionalString(
      body.damageDescription,
      'damageDescription',
      errors,
    );
  }

  if (hasOwn(body, 'paymentReceived')) {
    patch.paymentReceived = parseBoolean(body.paymentReceived, 'paymentReceived', errors, {
      required: true,
    });
  }

  if (hasOwn(body, 'repairCountSource')) {
    patch.repairCountSource = parseEnum(
      body.repairCountSource,
      'repairCountSource',
      REPAIR_COUNT_SOURCES,
      errors,
    );
  }

  if (hasOwn(body, 'repairCount')) {
    patch.repairCount = parseNullablePositiveInteger(body.repairCount, 'repairCount', errors);
  }

  if (hasOwn(body, 'repairMarks')) {
    patch.repairMarks = parseRepairMarkArray(
      body.repairMarks,
      'repairMarks',
      null,
      errors,
    );
  }

  if (hasOwn(body, 'publicNote')) {
    patch.publicNote = parseOptionalString(body.publicNote, 'publicNote', errors);
  }

  if (hasOwn(body, 'internalNote')) {
    patch.internalNote = parseOptionalString(body.internalNote, 'internalNote', errors);
  }

  if (hasOwn(body, 'pickupNote')) {
    patch.pickupNote = parseOptionalString(body.pickupNote, 'pickupNote', errors);
  }

  if (hasOwn(body, 'storageFeeWarningAfterDays')) {
    const value = parseInteger(
      body.storageFeeWarningAfterDays,
      'storageFeeWarningAfterDays',
      errors,
    );

    if (value !== undefined && (value < 1 || value > 32767)) {
      addError(errors, 'storageFeeWarningAfterDays', 'Must be between 1 and 32767.');
    }

    patch.storageFeeWarningAfterDays = value;
  }

  if (Object.keys(body).length === 0) {
    addError(errors, 'body', 'At least one update field is required.');
  }

  if (patch.repairCountSource === 'manual' && patch.repairCount === undefined) {
    addError(errors, 'repairCount', 'Is required when repairCountSource is manual.');
  }

  assertNoErrors(errors);

  return patch;
};

export const parseBulkStatusBody = (body: unknown): BulkStatusInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !BULK_STATUS_ALLOWED_FIELDS.includes(field as (typeof BULK_STATUS_ALLOWED_FIELDS)[number]),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  if (!hasOwn(body, 'paperOrderNos')) {
    addError(errors, 'paperOrderNos', 'Is required.');
  } else if (!Array.isArray(body.paperOrderNos)) {
    addError(errors, 'paperOrderNos', 'Must be an array of paper order numbers.');
  }

  const parsedPaperOrderNos = Array.isArray(body.paperOrderNos)
    ? body.paperOrderNos.map((value, index) =>
        parsePaperOrderNoValue(value, `paperOrderNos.${index}`, errors),
      )
    : [];

  if (Array.isArray(body.paperOrderNos) && body.paperOrderNos.length === 0) {
    addError(errors, 'paperOrderNos', 'Must include at least one paper order number.');
  }

  const status = hasOwn(body, 'status')
    ? parseEnum(body.status, 'status', WORK_ORDER_STATUSES, errors)
    : undefined;

  if (!hasOwn(body, 'status')) {
    addError(errors, 'status', 'Is required.');
  }

  const dedupedPaperOrderNos = new Set<string>();

  for (const paperOrderNo of parsedPaperOrderNos) {
    if (paperOrderNo) {
      dedupedPaperOrderNos.add(paperOrderNo);
    }
  }

  const input: BulkStatusInput = {
    paperOrderNos: Array.from(dedupedPaperOrderNos),
    requestedCount: Array.isArray(body.paperOrderNos) ? body.paperOrderNos.length : 0,
    status: status ?? 'RECEIVED',
  };

  if (hasOwn(body, 'note')) {
    input.note = parseOptionalString(body.note, 'note', errors);
  }

  assertNoErrors(errors);

  return input;
};

export const parseStatusTransitionBody = (body: unknown): StatusTransitionInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !STATUS_TRANSITION_ALLOWED_FIELDS.includes(
        field as (typeof STATUS_TRANSITION_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const status = hasOwn(body, 'status')
    ? parseEnum(body.status, 'status', WORK_ORDER_STATUSES, errors)
    : undefined;

  if (!hasOwn(body, 'status')) {
    addError(errors, 'status', 'Is required.');
  }

  const input: StatusTransitionInput = {
    hasInternalNote: hasOwn(body, 'internalNote'),
    status: status ?? 'RECEIVED',
  };

  if (hasOwn(body, 'note')) {
    input.note = parseOptionalString(body.note, 'note', errors);
  }

  if (input.hasInternalNote) {
    input.internalNote = parseOptionalString(body.internalNote, 'internalNote', errors);
  }

  assertNoErrors(errors);

  return input;
};

export const parseAdminWorkOrderScanQuickNoteBody = (
  body: unknown,
): AdminWorkOrderScanQuickNoteInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !ADMIN_WORK_ORDER_SCAN_QUICK_NOTE_ALLOWED_FIELDS.includes(
        field as (typeof ADMIN_WORK_ORDER_SCAN_QUICK_NOTE_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const note = hasOwn(body, 'note')
    ? parseRequiredString(body.note, 'note', errors, { maxLength: 2000 })
    : undefined;

  if (!hasOwn(body, 'note')) {
    addError(errors, 'note', 'Is required.');
  }

  assertNoErrors(errors);

  return {
    note: note as string,
  };
};
