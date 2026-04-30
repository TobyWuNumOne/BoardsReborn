import type { StatusCode } from 'h3';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INVALID_STATUS_TRANSITION'
  | 'STORAGE_UPLOAD_FAILED'
  | 'PRINT_JOB_NOT_CLAIMED'
  | 'PRINT_JOB_ALREADY_CLAIMED'
  | 'INTERNAL_SERVER_ERROR';

export type FieldErrors = Record<string, string[]>;

export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  statusCode: StatusCode;
  fieldErrors?: FieldErrors;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly statusCode: StatusCode;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.fieldErrors = options.fieldErrors;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication is required.') {
    super({ code: 'UNAUTHORIZED', message, statusCode: 401 });
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to access this resource.') {
    super({ code: 'FORBIDDEN', message, statusCode: 403 });
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found.') {
    super({ code: 'NOT_FOUND', message, statusCode: 404 });
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests.') {
    super({ code: 'TOO_MANY_REQUESTS', message, statusCode: 429 });
  }
}

export class ValidationError extends ApiError {
  constructor(fieldErrors: FieldErrors, message = 'Request validation failed.') {
    super({
      code: 'VALIDATION_ERROR',
      message,
      statusCode: 422,
      fieldErrors,
    });
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict.') {
    super({ code: 'CONFLICT', message, statusCode: 409 });
  }
}

export class InvalidStatusTransitionError extends ApiError {
  constructor(message = 'Invalid status transition.') {
    super({
      code: 'INVALID_STATUS_TRANSITION',
      message,
      statusCode: 422,
    });
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error.') {
    super({ code: 'INTERNAL_SERVER_ERROR', message, statusCode: 500 });
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const normalizeApiError = (error: unknown): ApiError => {
  if (isApiError(error)) {
    return error;
  }

  return new InternalServerError();
};
