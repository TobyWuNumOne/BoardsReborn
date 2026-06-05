import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from './api-errors';

export interface SupabaseLikeError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

const includesConstraint = (error: SupabaseLikeError, constraint: string): boolean =>
  [error.message, error.details, error.hint].some((value) => value?.includes(constraint));

const includesErrorText = (error: SupabaseLikeError, text: string): boolean =>
  [error.message, error.details, error.hint].some((value) => value?.includes(text));

export const throwMappedSupabaseError = (error: SupabaseLikeError): never => {
  if (error.code === '23505' && includesConstraint(error, 'work_orders_paper_order_no_key')) {
    throw new ConflictError('Paper order number already exists.');
  }

  if (error.code === '23505' && includesConstraint(error, 'print_devices_device_key_key')) {
    throw new ConflictError('Print device key already exists.');
  }

  if (error.code === '23505') {
    throw new ConflictError();
  }

  if (error.code === 'P0002' && includesErrorText(error, 'Work order not found')) {
    throw new NotFoundError('Work order not found.');
  }

  if (error.code === 'P0002' && includesErrorText(error, 'Print job not found')) {
    throw new NotFoundError('Print job not found.');
  }

  if (error.code === 'P0002' && includesErrorText(error, 'Print device not found')) {
    throw new NotFoundError('Print device not found.');
  }

  if (error.code === 'P0002') {
    throw new NotFoundError('Customer not found.');
  }

  if (error.code === '42501' && includesErrorText(error, 'Print device is inactive')) {
    throw new ForbiddenError('Print worker device is inactive.');
  }

  if (
    error.code === '23514' &&
    includesErrorText(error, 'SNOWBOARD work orders cannot enter DRYING')
  ) {
    throw new ValidationError({
      status: ['SNOWBOARD work orders cannot enter DRYING.'],
    });
  }

  if (
    error.code === '23514' &&
    includesErrorText(error, 'Only failed print jobs can be retried')
  ) {
    throw new ValidationError({
      status: ['Only failed print jobs can be retried.'],
    });
  }

  if (
    error.code === '23514' &&
    includesErrorText(error, 'Print barcode value is invalid')
  ) {
    throw new ValidationError({
      body: ['Print barcode value is invalid.'],
    });
  }

  if (
    error.code === '23514' &&
    includesErrorText(error, 'Print job is not locked by this device')
  ) {
    throw new ConflictError('Print job is not locked by this device.');
  }

  if (error.code === '23514' || error.code === '22P02') {
    throw new ValidationError({ body: ['Request data violates database constraints.'] });
  }

  throw new InternalServerError();
};
