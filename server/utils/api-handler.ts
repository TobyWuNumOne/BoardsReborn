import {
  defineEventHandler,
  setResponseStatus,
  type EventHandler,
  type EventHandlerRequest,
  type H3Event,
} from 'h3';
import { normalizeApiError, type ApiErrorCode, type FieldErrors } from './api-errors';
import { resolveRequestId } from './request-id';

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: FieldErrors;
    requestId: string;
  };
}

export type ApiRouteHandler<Response> = (event: H3Event) => Response | Promise<Response>;

export const createApiErrorEnvelope = (error: unknown, requestId: string): ApiErrorEnvelope => {
  const apiError = normalizeApiError(error);
  const envelope: ApiErrorEnvelope = {
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId,
    },
  };

  if (apiError.fieldErrors) {
    envelope.error.fieldErrors = apiError.fieldErrors;
  }

  return envelope;
};

export const handleApiError = (event: H3Event, error: unknown): ApiErrorEnvelope => {
  const requestId = resolveRequestId(event);
  const apiError = normalizeApiError(error);

  setResponseStatus(event, apiError.statusCode);

  return createApiErrorEnvelope(apiError, requestId);
};

export const defineApiHandler = <Response>(
  handler: ApiRouteHandler<Response>,
): EventHandler<EventHandlerRequest, Promise<Response | ApiErrorEnvelope>> =>
  defineEventHandler(async (event) => {
    resolveRequestId(event);

    try {
      return await handler(event);
    } catch (error) {
      return handleApiError(event, error);
    }
  });
