import type { H3Event } from 'h3';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  InvalidStatusTransitionError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type ApiError,
} from '../../server/utils/api-errors';
import { defineApiHandler } from '../../server/utils/api-handler';
import {
  ADMIN_PROFILE_SELECT,
  requireAdminContext,
  type AdminProfile,
  type AdminProfileLookupClient,
} from '../../server/utils/admin-auth';
import { resolveRequestId } from '../../server/utils/request-id';
import type { SupabaseUserClaims } from '../../server/utils/supabase-clients';

interface MockEvent {
  event: H3Event;
  responseHeaders: Map<string, string>;
  responseStatus: {
    code: number;
  };
}

const createMockEvent = (requestHeaders: Record<string, string | undefined> = {}): MockEvent => {
  const responseHeaders = new Map<string, string>();
  const responseStatus = { code: 200 };
  const normalizedRequestHeaders = Object.fromEntries(
    Object.entries(requestHeaders).map(([key, value]) => [key.toLowerCase(), value]),
  );

  const event = {
    context: {},
    node: {
      req: {
        headers: normalizedRequestHeaders,
      },
      res: {
        getHeader: (name: string) => responseHeaders.get(name.toLowerCase()),
        getHeaders: () => Object.fromEntries(responseHeaders),
        setHeader: (name: string, value: number | readonly string[] | string) =>
          responseHeaders.set(
            name.toLowerCase(),
            Array.isArray(value) ? value.join(', ') : String(value),
          ),
        statusCode: responseStatus.code,
      },
    },
  } as unknown as H3Event;

  Object.defineProperty(event.node.res, 'statusCode', {
    get: () => responseStatus.code,
    set: (value: number) => {
      responseStatus.code = value;
    },
  });

  return { event, responseHeaders, responseStatus };
};

const userClaims = (sub: string): SupabaseUserClaims => ({ sub }) as SupabaseUserClaims;

interface AdminProfileQueryResult {
  data: AdminProfile | null;
  error: { message: string } | null;
}

const createAdminProfileClient = (result: AdminProfileQueryResult) => {
  const calls = {
    eq: { column: '', value: '' },
    select: '',
    table: '',
  };

  const query = {
    eq(column: string, value: string) {
      calls.eq = { column, value };
      return query;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    select(columns: string) {
      calls.select = columns;
      return query;
    },
  };

  const client = {
    from(table: string) {
      calls.table = table;
      return query;
    },
  } as unknown as AdminProfileLookupClient;

  return { calls, client };
};

describe('server API foundation', () => {
  it('keeps API errors typed with shared status and codes', () => {
    const errors: ApiError[] = [
      new UnauthorizedError(),
      new ForbiddenError(),
      new NotFoundError(),
      new ValidationError({ 'customer.phone': ['Phone is required.'] }),
      new ConflictError(),
      new InvalidStatusTransitionError(),
      new InternalServerError(),
    ];

    expect(errors.map((error) => error.code)).toEqual([
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CONFLICT',
      'INVALID_STATUS_TRANSITION',
      'INTERNAL_SERVER_ERROR',
    ]);
    expect(errors.map((error) => error.statusCode)).toEqual([401, 403, 404, 422, 409, 422, 500]);
  });

  it('uses x-request-id when present and writes it back to the response', () => {
    const { event, responseHeaders } = createMockEvent({
      'x-request-id': 'req-from-client',
    });

    const requestId = resolveRequestId(event, {
      randomUUID: () => 'generated-id',
    });

    expect(requestId).toBe('req-from-client');
    expect(responseHeaders.get('x-request-id')).toBe('req-from-client');
  });

  it('generates requestId when missing and writes it back to the response', () => {
    const { event, responseHeaders } = createMockEvent();

    const requestId = resolveRequestId(event, {
      randomUUID: () => 'generated-id',
    });

    expect(requestId).toBe('generated-id');
    expect(responseHeaders.get('x-request-id')).toBe('generated-id');
  });

  it('returns known API errors as the shared error envelope', async () => {
    const { event, responseHeaders, responseStatus } = createMockEvent({
      'x-request-id': 'req-validation',
    });
    const handler = defineApiHandler(() => {
      throw new ValidationError({
        'customer.phone': ['Phone is required.'],
      });
    });

    const response = await handler(event);

    expect(responseStatus.code).toBe(422);
    expect(responseHeaders.get('x-request-id')).toBe('req-validation');
    expect(response).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: {
          'customer.phone': ['Phone is required.'],
        },
        message: 'Request validation failed.',
        requestId: 'req-validation',
      },
    });
  });

  it('maps unknown errors to internal server error without leaking messages', async () => {
    const { event, responseStatus } = createMockEvent();
    const handler = defineApiHandler(() => {
      throw new Error('database password leaked in stack');
    });

    const response = await handler(event);

    expect(responseStatus.code).toBe(500);
    expect(response).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
        requestId: expect.any(String),
      },
    });
  });

  it('requires a Supabase cookie session before admin profile lookup', async () => {
    const { event } = createMockEvent();

    await expect(
      requireAdminContext(event, {
        getSupabaseUser: () => Promise.resolve(null),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects authenticated users without an admin profile', async () => {
    const { client } = createAdminProfileClient({
      data: null,
      error: null,
    });
    const { event } = createMockEvent();

    await expect(
      requireAdminContext(event, {
        getSupabaseClient: () => Promise.resolve(client),
        getSupabaseUser: () => Promise.resolve(userClaims('user-1')),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns admin context using the minimal admin profile columns', async () => {
    const profile = {
      display_name: 'Admin',
      id: 'user-1',
    };
    const { calls, client } = createAdminProfileClient({
      data: profile,
      error: null,
    });
    const { event } = createMockEvent();

    const context = await requireAdminContext(event, {
      getSupabaseClient: () => Promise.resolve(client),
      getSupabaseUser: () => Promise.resolve(userClaims('user-1')),
    });

    expect(context).toEqual({
      profile,
      supabase: client,
      userId: 'user-1',
    });
    expect(calls).toEqual({
      eq: { column: 'id', value: 'user-1' },
      select: ADMIN_PROFILE_SELECT,
      table: 'admin_profiles',
    });
  });
});
