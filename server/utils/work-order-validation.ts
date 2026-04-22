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
  'publicNote',
  'internalNote',
  'pickupNote',
  'storageFeeWarningAfterDays',
] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type BoardType = Database['public']['Enums']['board_type'];
export type QuoteItemType = Database['public']['Enums']['quote_item_type'];
export type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
export type WorkOrderListSortField = (typeof WORK_ORDER_LIST_SORT_FIELDS)[number];

export interface CustomerLookupQuery {
  normalizedPhone: string;
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
  quoteItems: Array<{
    amount: number;
    description: string;
    itemType: QuoteItemType;
  }>;
  workOrder: {
    damageDescription?: string | null;
    estimatedCompletionDate?: string | null;
    intakeDate: string;
    internalNote?: string | null;
    paperOrderNo: string;
    paymentReceived: boolean;
    publicNote?: string | null;
  };
}

export interface PatchWorkOrderInput {
  damageDescription?: string | null;
  estimatedCompletionDate?: string | null;
  internalNote?: string | null;
  paymentReceived?: boolean;
  pickupNote?: string | null;
  publicNote?: string | null;
  storageFeeWarningAfterDays?: number;
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

export const parseUuid = (value: unknown, field: string): string => {
  const errors: ErrorCollector = {};
  const parsedValue = parseUuidValue(value, field, errors);

  assertNoErrors(errors);
  return parsedValue as string;
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
      boardType: 'SURFBOARD',
    },
    customerMode: customerMode ?? 'create',
    quoteItems: [],
    workOrder: {
      intakeDate: '',
      paperOrderNo: '',
      paymentReceived: false,
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
  }

  if (workOrder) {
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
      paperOrderNo:
        parseRequiredString(workOrder.paperOrderNo, 'workOrder.paperOrderNo', errors, {
          maxLength: 50,
          minLength: 3,
        }) ?? '',
      paymentReceived:
        parseBoolean(workOrder.paymentReceived, 'workOrder.paymentReceived', errors, {
          defaultValue: false,
        }) ?? false,
      publicNote: parseOptionalString(workOrder.publicNote, 'workOrder.publicNote', errors),
    };
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

  assertNoErrors(errors);

  return parsedInput;
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

  assertNoErrors(errors);

  return patch;
};
