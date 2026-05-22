import { ValidationError, type FieldErrors } from './api-errors';
import type { Database } from '../../types/database.types';
import { parseUuid } from './work-order-validation';

const PRINT_JOB_STATUSES = [
  'pending',
  'locked',
  'printing',
  'printed',
  'failed',
  'cancelled',
] as const;
const PRINT_JOB_TYPES = ['work_order_label'] as const;
const PRINT_JOB_LIST_ALLOWED_FIELDS = ['page', 'pageSize', 'sort', 'status', 'workOrderId'] as const;
const ADMIN_PRINT_JOB_CREATE_ALLOWED_FIELDS = ['jobType', 'workOrderId'] as const;
const WORKER_CLAIM_ALLOWED_FIELDS = ['deviceKey'] as const;
const WORKER_FAIL_ALLOWED_FIELDS = ['deviceKey', 'error'] as const;
const WORKER_SUCCEED_ALLOWED_FIELDS = ['deviceKey'] as const;

export type PrintJobStatus = Database['public']['Enums']['print_job_status'];
export type PrintJobType = Database['public']['Enums']['print_job_type'];
export type PrintJobListSortField = 'created_at' | 'updated_at';

export interface PrintJobListQuery {
  filters: {
    status?: PrintJobStatus;
    workOrderId?: string;
  };
  page: number;
  pageSize: number;
  sort: {
    direction: 'asc' | 'desc';
    field: PrintJobListSortField;
  };
}

export interface CreatePrintJobInput {
  jobType: PrintJobType;
  workOrderId: string;
}

export interface ClaimPrintJobInput {
  deviceKey: string;
}

export interface FailPrintJobInput {
  deviceKey: string;
  error: string;
}

export interface SucceedPrintJobInput {
  deviceKey: string;
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

const parsePositiveInteger = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    addError(errors, field, 'Must be a positive integer.');
    return undefined;
  }

  const normalizedValue = String(value);

  if (!/^\d+$/.test(normalizedValue)) {
    addError(errors, field, 'Must be a positive integer.');
    return undefined;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (parsedValue < 1) {
    addError(errors, field, 'Must be greater than 0.');
    return undefined;
  }

  return parsedValue;
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

export const parsePrintJobListQuery = (query: Record<string, unknown>): PrintJobListQuery => {
  const errors: ErrorCollector = {};
  const unknownFields = Object.keys(query).filter(
    (field) =>
      !PRINT_JOB_LIST_ALLOWED_FIELDS.includes(field as (typeof PRINT_JOB_LIST_ALLOWED_FIELDS)[number]),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const pageValue = getSingleQueryValue(query, 'page', errors);
  const pageSizeValue = getSingleQueryValue(query, 'pageSize', errors);
  const sortValue = getSingleQueryValue(query, 'sort', errors);
  const statusValue = getSingleQueryValue(query, 'status', errors);
  const workOrderIdValue = getSingleQueryValue(query, 'workOrderId', errors);

  const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue, 'page', errors);
  const pageSize =
    pageSizeValue === undefined ? 20 : parsePositiveInteger(pageSizeValue, 'pageSize', errors);
  const status =
    statusValue === undefined
      ? undefined
      : parseEnum(statusValue, 'status', PRINT_JOB_STATUSES, errors);
  const workOrderId =
    workOrderIdValue === undefined ? undefined : parseUuid(workOrderIdValue, 'workOrderId');

  let sort: PrintJobListQuery['sort'] = {
    direction: 'desc',
    field: 'created_at',
  };

  if (sortValue) {
    const [field, direction, extra] = sortValue.split(':');
    const normalizedField =
      field === 'createdAt' ? 'created_at' : field === 'updatedAt' ? 'updated_at' : undefined;

    if (
      extra ||
      !normalizedField ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      addError(errors, 'sort', 'Must be createdAt:asc, createdAt:desc, updatedAt:asc, or updatedAt:desc.');
    } else {
      sort = {
        direction,
        field: normalizedField,
      };
    }
  }

  if (pageSize !== undefined && pageSize > 100) {
    addError(errors, 'pageSize', 'Must be between 1 and 100.');
  }

  assertNoErrors(errors);

  return {
    filters: {
      status,
      workOrderId,
    },
    page: page as number,
    pageSize: pageSize as number,
    sort,
  };
};

export const parseCreatePrintJobBody = (body: unknown): CreatePrintJobInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !ADMIN_PRINT_JOB_CREATE_ALLOWED_FIELDS.includes(
        field as (typeof ADMIN_PRINT_JOB_CREATE_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const workOrderId = hasOwn(body, 'workOrderId') ? parseUuid(body.workOrderId, 'workOrderId') : '';
  const jobType = hasOwn(body, 'jobType')
    ? parseEnum(body.jobType, 'jobType', PRINT_JOB_TYPES, errors)
    : undefined;

  if (!hasOwn(body, 'workOrderId')) {
    addError(errors, 'workOrderId', 'Is required.');
  }

  if (!hasOwn(body, 'jobType')) {
    addError(errors, 'jobType', 'Is required.');
  }

  assertNoErrors(errors);

  return {
    jobType: jobType as PrintJobType,
    workOrderId,
  };
};

export const parseClaimPrintJobBody = (body: unknown): ClaimPrintJobInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !WORKER_CLAIM_ALLOWED_FIELDS.includes(field as (typeof WORKER_CLAIM_ALLOWED_FIELDS)[number]),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const deviceKey = parseRequiredString(body.deviceKey, 'deviceKey', errors, {
    maxLength: 120,
    minLength: 3,
  });

  assertNoErrors(errors);

  return {
    deviceKey: deviceKey as string,
  };
};

export const parseSucceedPrintJobBody = (body: unknown): SucceedPrintJobInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !WORKER_SUCCEED_ALLOWED_FIELDS.includes(
        field as (typeof WORKER_SUCCEED_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const deviceKey = parseRequiredString(body.deviceKey, 'deviceKey', errors, {
    maxLength: 120,
    minLength: 3,
  });

  assertNoErrors(errors);

  return {
    deviceKey: deviceKey as string,
  };
};

export const parseFailPrintJobBody = (body: unknown): FailPrintJobInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !WORKER_FAIL_ALLOWED_FIELDS.includes(field as (typeof WORKER_FAIL_ALLOWED_FIELDS)[number]),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const deviceKey = parseRequiredString(body.deviceKey, 'deviceKey', errors, {
    maxLength: 120,
    minLength: 3,
  });
  const error = parseRequiredString(body.error, 'error', errors, {
    maxLength: 1000,
    minLength: 1,
  });

  assertNoErrors(errors);

  return {
    deviceKey: deviceKey as string,
    error: error as string,
  };
};
