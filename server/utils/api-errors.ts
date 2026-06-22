import type { StatusCode } from 'h3';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'CUSTOMER_ALREADY_BOUND'
  | 'CUSTOMER_ALREADY_BOUND_TO_OTHER_LINE'
  | 'LINE_ACCESS_TOKEN_INVALID'
  | 'LINE_ALREADY_BOUND_TO_OTHER_CUSTOMER'
  | 'LINE_ID_TOKEN_INVALID'
  | 'LINE_PLATFORM_UNAVAILABLE'
  | 'LINE_BIND_TOKEN_REQUIRED'
  | 'LINE_WEBHOOK_SIGNATURE_INVALID'
  | 'NO_ACTIVE_LINE_BINDING'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_REVOKED'
  | 'TOKEN_USED'
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

export class CustomerAlreadyBoundError extends ApiError {
  constructor(message = 'Customer already has an active LINE binding.') {
    super({ code: 'CUSTOMER_ALREADY_BOUND', message, statusCode: 409 });
  }
}

export class NoActiveLineBindingError extends ApiError {
  constructor(message = 'Customer has no active LINE binding.') {
    super({ code: 'NO_ACTIVE_LINE_BINDING', message, statusCode: 404 });
  }
}

export class TokenInvalidError extends ApiError {
  constructor(message = 'LINE binding token is invalid.') {
    super({ code: 'TOKEN_INVALID', message, statusCode: 404 });
  }
}

export class TokenExpiredError extends ApiError {
  constructor(message = 'LINE binding token has expired.') {
    super({ code: 'TOKEN_EXPIRED', message, statusCode: 410 });
  }
}

export class TokenUsedError extends ApiError {
  constructor(message = 'LINE binding token has already been used.') {
    super({ code: 'TOKEN_USED', message, statusCode: 409 });
  }
}

export class TokenRevokedError extends ApiError {
  constructor(message = 'LINE binding token has been revoked.') {
    super({ code: 'TOKEN_REVOKED', message, statusCode: 410 });
  }
}

export class LineIdTokenInvalidError extends ApiError {
  constructor(message = 'LINE ID token is invalid.') {
    super({ code: 'LINE_ID_TOKEN_INVALID', message, statusCode: 401 });
  }
}

export class LineAccessTokenInvalidError extends ApiError {
  constructor(message = 'LINE access token is invalid.') {
    super({ code: 'LINE_ACCESS_TOKEN_INVALID', message, statusCode: 401 });
  }
}

export class LinePlatformUnavailableError extends ApiError {
  constructor(message = 'LINE Platform is temporarily unavailable.') {
    super({ code: 'LINE_PLATFORM_UNAVAILABLE', message, statusCode: 503 });
  }
}

export class LineAlreadyBoundToOtherCustomerError extends ApiError {
  constructor(message = 'This LINE account is already bound to another customer.') {
    super({ code: 'LINE_ALREADY_BOUND_TO_OTHER_CUSTOMER', message, statusCode: 409 });
  }
}

export class CustomerAlreadyBoundToOtherLineError extends ApiError {
  constructor(message = 'This customer is already bound to another LINE account.') {
    super({ code: 'CUSTOMER_ALREADY_BOUND_TO_OTHER_LINE', message, statusCode: 409 });
  }
}

export class LineBindTokenRequiredError extends ApiError {
  constructor() {
    super({
      code: 'LINE_BIND_TOKEN_REQUIRED',
      message: '請先重新發行 LINE 綁定 QR Code，再建立留存聯補印。',
      statusCode: 409,
    });
  }
}

export class LineWebhookSignatureInvalidError extends ApiError {
  constructor(message = 'LINE webhook signature is invalid.') {
    super({ code: 'LINE_WEBHOOK_SIGNATURE_INVALID', message, statusCode: 401 });
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
