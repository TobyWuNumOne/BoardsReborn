import crypto from 'node:crypto';
import { getHeader, setHeader, type H3Event } from 'h3';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface ResolveRequestIdOptions {
  randomUUID?: () => string;
}

const normalizeRequestId = (value: string | undefined): string | undefined => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
};

export const resolveRequestId = (event: H3Event, options: ResolveRequestIdOptions = {}): string => {
  const existingContextRequestId = normalizeRequestId(event.context.requestId);

  if (existingContextRequestId) {
    setHeader(event, REQUEST_ID_HEADER, existingContextRequestId);
    return existingContextRequestId;
  }

  const incomingRequestId = normalizeRequestId(getHeader(event, REQUEST_ID_HEADER));
  const requestId = incomingRequestId ?? (options.randomUUID ?? crypto.randomUUID)();

  event.context.requestId = requestId;
  setHeader(event, REQUEST_ID_HEADER, requestId);

  return requestId;
};
