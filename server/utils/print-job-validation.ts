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
const PRINT_JOB_TYPES = ['work_order_label', 'customer_receipt'] as const;
const PRINT_DEVICE_STATUSES = ['active', 'inactive', 'error'] as const;
const PRINT_JOB_LIST_ALLOWED_FIELDS = [
  'page',
  'pageSize',
  'sort',
  'status',
  'workOrderId',
  'paperOrderNo',
] as const;
const PRINT_SUMMARY_ALLOWED_FIELDS = ['workOrderId'] as const;
const ADMIN_PRINT_JOB_CREATE_ALLOWED_FIELDS = ['jobType', 'workOrderId'] as const;
const PRINT_DEVICE_LIST_ALLOWED_FIELDS = ['page', 'pageSize', 'sort', 'status', 'q'] as const;
const ADMIN_PRINT_DEVICE_CREATE_ALLOWED_FIELDS = [
  'deviceKey',
  'location',
  'name',
  'status',
] as const;
const ADMIN_PRINT_DEVICE_UPDATE_ALLOWED_FIELDS = ['name', 'location', 'status'] as const;
const WORKER_CLAIM_ALLOWED_FIELDS = ['deviceKey'] as const;
const WORKER_FAIL_ALLOWED_FIELDS = ['deviceKey', 'error'] as const;
const WORKER_SUCCEED_ALLOWED_FIELDS = ['deviceKey'] as const;

export type PrintJobStatus = Database['public']['Enums']['print_job_status'];
export type PrintJobType = Database['public']['Enums']['print_job_type'];
export type PrintDeviceStatus = Database['public']['Enums']['print_device_status'];
export type PrintJobListSortField = 'created_at' | 'updated_at';
export type PrintDeviceListSortField =
  | 'created_at'
  | 'updated_at'
  | 'last_seen_at'
  | 'name'
  | 'status';

export interface PrintJobListQuery {
  filters: {
    paperOrderNo?: string;
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

export interface PrintSummaryQuery {
  workOrderIds: string[];
}

export interface PrintDeviceListQuery {
  filters: {
    q?: string;
    status?: PrintDeviceStatus;
  };
  page: number;
  pageSize: number;
  sort: {
    direction: 'asc' | 'desc';
    field: PrintDeviceListSortField;
  };
}

export interface UpdatePrintDeviceInput {
  location?: string | null;
  name?: string;
  status?: PrintDeviceStatus;
}

export interface CreatePrintDeviceInput {
  deviceKey: string;
  location?: string | null;
  name: string;
  status: PrintDeviceStatus;
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

const getMultiQueryValues = (
  query: Record<string, unknown>,
  field: string,
  errors: ErrorCollector,
): string[] => {
  const value = query[field];

  if (value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const values: string[] = [];

    for (const entry of value) {
      if (typeof entry !== 'string') {
        addError(errors, field, 'Must be a string.');
        continue;
      }

      values.push(entry);
    }

    return values;
  }

  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string.');
    return [];
  }

  return [value];
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

const parseOptionalNullableString = (
  value: unknown,
  field: string,
  errors: ErrorCollector,
  options: { maxLength?: number } = {},
) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    addError(errors, field, 'Must be a string or null.');
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
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
      !PRINT_JOB_LIST_ALLOWED_FIELDS.includes(
        field as (typeof PRINT_JOB_LIST_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const pageValue = getSingleQueryValue(query, 'page', errors);
  const pageSizeValue = getSingleQueryValue(query, 'pageSize', errors);
  const sortValue = getSingleQueryValue(query, 'sort', errors);
  const statusValue = getSingleQueryValue(query, 'status', errors);
  const workOrderIdValue = getSingleQueryValue(query, 'workOrderId', errors);
  const paperOrderNoValue = getSingleQueryValue(query, 'paperOrderNo', errors);

  const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue, 'page', errors);
  const pageSize =
    pageSizeValue === undefined ? 20 : parsePositiveInteger(pageSizeValue, 'pageSize', errors);
  const status =
    statusValue === undefined
      ? undefined
      : parseEnum(statusValue, 'status', PRINT_JOB_STATUSES, errors);
  const workOrderId =
    workOrderIdValue === undefined ? undefined : parseUuid(workOrderIdValue, 'workOrderId');
  const paperOrderNo =
    paperOrderNoValue === undefined
      ? undefined
      : parseRequiredString(paperOrderNoValue, 'paperOrderNo', errors, {
          maxLength: 40,
          minLength: 1,
        });

  let sort: PrintJobListQuery['sort'] = {
    direction: 'desc',
    field: 'created_at',
  };

  if (sortValue) {
    const [field, direction, extra] = sortValue.split(':');
    const normalizedField =
      field === 'createdAt' ? 'created_at' : field === 'updatedAt' ? 'updated_at' : undefined;

    if (extra || !normalizedField || (direction !== 'asc' && direction !== 'desc')) {
      addError(
        errors,
        'sort',
        'Must be createdAt:asc, createdAt:desc, updatedAt:asc, or updatedAt:desc.',
      );
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
      paperOrderNo,
      status,
      workOrderId,
    },
    page: page as number,
    pageSize: pageSize as number,
    sort,
  };
};

export const parsePrintSummaryQuery = (query: Record<string, unknown>): PrintSummaryQuery => {
  const errors: ErrorCollector = {};
  const unknownFields = Object.keys(query).filter(
    (field) =>
      !PRINT_SUMMARY_ALLOWED_FIELDS.includes(
        field as (typeof PRINT_SUMMARY_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const rawWorkOrderIds = getMultiQueryValues(query, 'workOrderId', errors);
  const dedupedWorkOrderIds: string[] = [];
  const seenIds = new Set<string>();

  if (rawWorkOrderIds.length === 0) {
    addError(errors, 'workOrderId', 'Is required.');
  }

  if (rawWorkOrderIds.length > 50) {
    addError(errors, 'workOrderId', 'Must include at most 50 values.');
  }

  for (const rawValue of rawWorkOrderIds) {
    let parsedValue: string;

    try {
      parsedValue = parseUuid(rawValue, 'workOrderId');
    } catch {
      addError(errors, 'workOrderId', 'Must be a valid UUID.');
      continue;
    }

    if (seenIds.has(parsedValue)) {
      continue;
    }

    seenIds.add(parsedValue);
    dedupedWorkOrderIds.push(parsedValue);
  }

  assertNoErrors(errors);

  return {
    workOrderIds: dedupedWorkOrderIds,
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

export const parsePrintDeviceListQuery = (query: Record<string, unknown>): PrintDeviceListQuery => {
  const errors: ErrorCollector = {};
  const unknownFields = Object.keys(query).filter(
    (field) =>
      !PRINT_DEVICE_LIST_ALLOWED_FIELDS.includes(
        field as (typeof PRINT_DEVICE_LIST_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const pageValue = getSingleQueryValue(query, 'page', errors);
  const pageSizeValue = getSingleQueryValue(query, 'pageSize', errors);
  const sortValue = getSingleQueryValue(query, 'sort', errors);
  const statusValue = getSingleQueryValue(query, 'status', errors);
  const qValue = getSingleQueryValue(query, 'q', errors);

  const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue, 'page', errors);
  const pageSize =
    pageSizeValue === undefined ? 20 : parsePositiveInteger(pageSizeValue, 'pageSize', errors);
  const status =
    statusValue === undefined
      ? undefined
      : parseEnum(statusValue, 'status', PRINT_DEVICE_STATUSES, errors);
  const q =
    qValue === undefined
      ? undefined
      : parseRequiredString(qValue, 'q', errors, {
          maxLength: 120,
          minLength: 1,
        });

  let sort: PrintDeviceListQuery['sort'] = {
    direction: 'desc',
    field: 'updated_at',
  };

  if (sortValue) {
    const [field, direction, extra] = sortValue.split(':');
    const normalizedField =
      field === 'createdAt'
        ? 'created_at'
        : field === 'updatedAt'
          ? 'updated_at'
          : field === 'lastSeenAt'
            ? 'last_seen_at'
            : field === 'name' || field === 'status'
              ? (field as PrintDeviceListSortField)
              : undefined;

    if (!normalizedField || extra || (direction !== 'asc' && direction !== 'desc')) {
      addError(
        errors,
        'sort',
        'Must be updatedAt:asc, updatedAt:desc, createdAt:asc, createdAt:desc, lastSeenAt:asc, lastSeenAt:desc, name:asc, name:desc, status:asc, or status:desc.',
      );
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
      q,
      status,
    },
    page: page as number,
    pageSize: pageSize as number,
    sort,
  };
};

export const parseCreatePrintDeviceBody = (body: unknown): CreatePrintDeviceInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !ADMIN_PRINT_DEVICE_CREATE_ALLOWED_FIELDS.includes(
        field as (typeof ADMIN_PRINT_DEVICE_CREATE_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const name = hasOwn(body, 'name')
    ? parseRequiredString(body.name, 'name', errors, {
        maxLength: 80,
        minLength: 1,
      })
    : undefined;
  const deviceKey = hasOwn(body, 'deviceKey')
    ? parseRequiredString(body.deviceKey, 'deviceKey', errors, {
        maxLength: 120,
        minLength: 3,
      })
    : undefined;
  const location = hasOwn(body, 'location')
    ? parseOptionalNullableString(body.location, 'location', errors, {
        maxLength: 120,
      })
    : undefined;
  const status = hasOwn(body, 'status')
    ? parseEnum(body.status, 'status', PRINT_DEVICE_STATUSES, errors)
    : 'active';

  if (!hasOwn(body, 'name')) {
    addError(errors, 'name', 'Is required.');
  }

  if (!hasOwn(body, 'deviceKey')) {
    addError(errors, 'deviceKey', 'Is required.');
  }

  assertNoErrors(errors);

  return {
    deviceKey: deviceKey as string,
    ...(location !== undefined ? { location } : {}),
    name: name as string,
    status: status as PrintDeviceStatus,
  };
};

export const parseUpdatePrintDeviceBody = (body: unknown): UpdatePrintDeviceInput => {
  const errors: ErrorCollector = {};

  if (!isRecord(body)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }

  const unknownFields = Object.keys(body).filter(
    (field) =>
      !ADMIN_PRINT_DEVICE_UPDATE_ALLOWED_FIELDS.includes(
        field as (typeof ADMIN_PRINT_DEVICE_UPDATE_ALLOWED_FIELDS)[number],
      ),
  );

  for (const field of unknownFields) {
    addError(errors, field, 'Cannot be used by this endpoint.');
  }

  const input: UpdatePrintDeviceInput = {};

  if (hasOwn(body, 'name')) {
    const name = parseRequiredString(body.name, 'name', errors, {
      maxLength: 80,
      minLength: 1,
    });

    if (name !== undefined) {
      input.name = name;
    }
  }

  if (hasOwn(body, 'location')) {
    const location = parseOptionalNullableString(body.location, 'location', errors, {
      maxLength: 120,
    });

    if (location !== undefined) {
      input.location = location;
    }
  }

  if (hasOwn(body, 'status')) {
    const status = parseEnum(body.status, 'status', PRINT_DEVICE_STATUSES, errors);

    if (status !== undefined) {
      input.status = status;
    }
  }

  if (!hasOwn(body, 'name') && !hasOwn(body, 'location') && !hasOwn(body, 'status')) {
    addError(errors, 'body', 'At least one updatable field is required.');
  }

  assertNoErrors(errors);

  return input;
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
