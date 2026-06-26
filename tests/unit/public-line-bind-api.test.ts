import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerAlreadyBoundToOtherLineError,
  LineAlreadyBoundToOtherCustomerError,
  TokenInvalidError,
  ValidationError,
} from '../../server/utils/api-errors';
import {
  confirmPublicLineBinding,
  mapPublicLineBindResolve,
  parsePublicLineBindConfirmBody,
  parsePublicLineBindResolveBody,
} from '../../server/utils/public-line-bindings';
import { hashLineBindToken } from '../../server/utils/line-bind-tokens';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public LINE binding validation and resolve', () => {
  it('keeps both public routes no-store and free of token logging', () => {
    for (const routePath of [
      'server/api/public/line-bind/resolve.post.ts',
      'server/api/public/line-bind/confirm.post.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      expect(source).toContain("setHeader(event, 'Cache-Control', 'no-store')");
      expect(source).not.toContain('console.');
    }
  });

  it('uses best-effort drain after confirm without exposing the internal processor endpoint', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/public/line-bind/confirm.post.ts'),
      'utf8',
    );

    expect(source).toContain('drainLineJobsAfterLinkedBindingBestEffort');
    expect(source).toContain('lineChannelAccessToken');
    expect(source).not.toContain('/api/internal/line-jobs/process');
    expect(source).not.toContain('LINE_JOB_PROCESSOR_SECRET');
    expect(source).not.toContain('requireLineJobProcessorSecret');
  });

  it('accepts only token, idToken, and optional accessToken', () => {
    expect(parsePublicLineBindResolveBody({ token: 'token-value' })).toEqual({
      token: 'token-value',
    });
    expect(
      parsePublicLineBindConfirmBody({
        accessToken: 'access-token',
        idToken: 'id-token',
        token: 'token-value',
      }),
    ).toEqual({ accessToken: 'access-token', idToken: 'id-token', token: 'token-value' });
    expect(() =>
      parsePublicLineBindConfirmBody({
        idToken: 'id-token',
        line_user_id: 'U-untrusted',
        token: 'token-value',
      }),
    ).toThrow(ValidationError);
  });

  it.each(['pending', 'used', 'expired', 'revoked'] as const)(
    'maps known token state %s to a safe 200 payload',
    (state) => {
      const response = mapPublicLineBindResolve({
        bindingExists: false,
        boardType: 'SURFBOARD',
        expiresAt: '2026-07-21T10:00:00.000Z',
        paperOrderNo: '260001',
        tokenState: state,
      });

      expect(response.data).toEqual({
        bindingState: 'unbound',
        canBind: state === 'pending',
        expiresAt: '2026-07-21T10:00:00.000Z',
        tokenState: state,
        workOrder: { boardType: 'SURFBOARD', paperOrderNo: '260001' },
      });
      const serialized = JSON.stringify(response);
      for (const forbidden of ['phone', 'name', 'quote', 'damage']) {
        expect(serialized.toLowerCase()).not.toContain(forbidden);
      }
    },
  );

  it('treats a missing token row as TOKEN_INVALID', () => {
    expect(() => mapPublicLineBindResolve(null)).toThrow(TokenInvalidError);
  });
});

describe('public LINE binding confirm', () => {
  const lineIdentity = {
    displayName: 'LINE User',
    friendship: 'unknown' as const,
    lineUserId: 'U-trusted',
    pictureUrl: null,
  };

  it('verifies LINE before starting the database transaction', async () => {
    const calls: string[] = [];
    const client = {
      async rpc() {
        calls.push('rpc');
        return {
          data: {
            jobType: 'line_binding_success',
            linkedAt: '2026-06-21T10:00:00.000Z',
            notificationStatus: 'unknown',
            outcome: 'linked',
            paperOrderNo: '260001',
            usedAt: '2026-06-21T10:00:00.000Z',
          },
          error: null,
        };
      },
    };
    const verify = async () => {
      calls.push('verify');
      return lineIdentity;
    };

    const response = await confirmPublicLineBinding(
      client as never,
      { idToken: 'id-token', token: 'plaintext-token' },
      {
        officialLineUrl: 'https://line.me/R/ti/p/@official',
        verifyLineIdentity: verify,
      },
    );

    expect(calls).toEqual(['verify', 'rpc']);
    expect(response.data).toMatchObject({
      outcome: 'linked',
      next: {
        officialLineUrl: 'https://line.me/R/ti/p/@official',
        repairStatusUrl: '/repair-status',
      },
    });
  });

  it.each([
    ['line_conflict', LineAlreadyBoundToOtherCustomerError],
    ['customer_conflict', CustomerAlreadyBoundToOtherLineError],
  ] as const)('maps committed %s outcomes to typed conflicts', async (outcome, ErrorType) => {
    const client = {
      async rpc() {
        return { data: { outcome }, error: null };
      },
    };

    await expect(
      confirmPublicLineBinding(
        client as never,
        { idToken: 'id-token', token: 'plaintext-token' },
        {
          officialLineUrl: 'https://line.me/official',
          verifyLineIdentity: async () => lineIdentity,
        },
      ),
    ).rejects.toBeInstanceOf(ErrorType);
  });

  it('does not call the transaction when LINE verification fails', async () => {
    let rpcCalled = false;
    const client = {
      async rpc() {
        rpcCalled = true;
        return { data: null, error: null };
      },
    };

    await expect(
      confirmPublicLineBinding(
        client as never,
        { idToken: 'invalid', token: 'plaintext-token' },
        {
          officialLineUrl: 'https://line.me/official',
          verifyLineIdentity: async () => {
            throw new Error('verification failed');
          },
        },
      ),
    ).rejects.toThrow('verification failed');
    expect(rpcCalled).toBe(false);
  });

  it('logs sanitized RPC diagnostics without exposing LINE secrets or token values', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const plaintextToken = 'plaintext-token';
    const tokenHash = hashLineBindToken(plaintextToken);
    const sensitiveLineUserId = 'U1234567890abcdef1234567890abcdef';
    const client = {
      async rpc() {
        return {
          data: null,
          error: {
            code: '23514',
            details: `constraint failed for ${sensitiveLineUserId} and Uabcdefabcdefabcdefabcdefabcdefabcdef`,
            hint: `token hash ${tokenHash}`,
            message: `bad token ${plaintextToken}`,
          },
        };
      },
    };

    await expect(
      confirmPublicLineBinding(
        client as never,
        { idToken: 'id-token', token: plaintextToken },
        {
          officialLineUrl: 'https://line.me/official',
          verifyLineIdentity: async () => ({
            ...lineIdentity,
            lineUserId: sensitiveLineUserId,
          }),
        },
      ),
    ).rejects.toThrow(ValidationError);

    expect(consoleError).toHaveBeenCalledOnce();
    const serializedLog = JSON.stringify(consoleError.mock.calls[0]);
    expect(serializedLog).toContain('LINE binding confirm RPC failed');
    expect(serializedLog).toContain('[redacted]');
    expect(serializedLog).toContain('[redacted-line-user]');
    expect(serializedLog).not.toContain(plaintextToken);
    expect(serializedLog).not.toContain(tokenHash);
    expect(serializedLog).not.toContain(sensitiveLineUserId);
  });
});
