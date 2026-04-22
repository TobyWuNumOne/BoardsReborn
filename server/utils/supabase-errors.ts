import { ConflictError, InternalServerError, NotFoundError, ValidationError } from './api-errors';

export interface SupabaseLikeError {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
}

const includesConstraint = (error: SupabaseLikeError, constraint: string): boolean =>
  [error.message, error.details, error.hint].some((value) => value?.includes(constraint));

export const throwMappedSupabaseError = (error: SupabaseLikeError): never => {
  if (error.code === '23505' && includesConstraint(error, 'work_orders_paper_order_no_key')) {
    throw new ConflictError('Paper order number already exists.');
  }

  if (error.code === '23505') {
    throw new ConflictError();
  }

  if (error.code === 'P0002') {
    throw new NotFoundError('Customer not found.');
  }

  if (error.code === '23514' || error.code === '22P02') {
    throw new ValidationError({ body: ['Request data violates database constraints.'] });
  }

  throw new InternalServerError();
};
