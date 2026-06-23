import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLineBindLiffUrl,
  deriveLineBindPlaintextToken,
  deriveLineBindTokenState,
  hashLineBindToken,
  issueLineBindToken,
  rebuildLineBindLiffUrl,
  resolveLineBindToken,
  resolveLineBindTokenConfig,
  revokePendingLineBindTokens,
} from '../../server/utils/line-bind-tokens';

const TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TOKEN_ID = '22222222-2222-4222-8222-222222222222';
const SECRET = 'line-bind-secret-for-tests';

describe('LINE bind token cryptography', () => {
  it('keeps the HMAC secret private and does not add token logging', () => {
    const nuxtConfig = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8');
    const tokenService = readFileSync(
      resolve(process.cwd(), 'server/utils/line-bind-tokens.ts'),
      'utf8',
    );

    expect(nuxtConfig).toContain("lineBindTokenSecret: process.env.LINE_BIND_TOKEN_SECRET || ''");
    expect(nuxtConfig).toContain('liffId: publicLiffId');
    expect(nuxtConfig).not.toMatch(/public:\s*\{[^}]*lineBindTokenSecret/s);
    expect(tokenService).not.toContain('console.');
  });

  it('rebuilds a stable HMAC token while separating row IDs and secrets', () => {
    const token = deriveLineBindPlaintextToken(TOKEN_ID, SECRET);

    expect(deriveLineBindPlaintextToken(TOKEN_ID, SECRET)).toBe(token);
    expect(deriveLineBindPlaintextToken(OTHER_TOKEN_ID, SECRET)).not.toBe(token);
    expect(deriveLineBindPlaintextToken(TOKEN_ID, 'different-secret')).not.toBe(token);
    expect(token).toBe(createHmac('sha256', SECRET).update(TOKEN_ID).digest('base64url'));
    expect(token).not.toContain(TOKEN_ID);
  });

  it('hashes plaintext tokens with stable SHA-256 hex', () => {
    const token = deriveLineBindPlaintextToken(TOKEN_ID, SECRET);
    const hash = hashLineBindToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLineBindToken(token)).toBe(hash);
    expect(hash).not.toBe(token);
  });

  it('fails fast when the server secret or public LIFF ID is missing', () => {
    expect(() =>
      resolveLineBindTokenConfig({ lineBindTokenSecret: '', liffId: '1234567890-test' }),
    ).toThrow('LINE bind token configuration is missing.');
    expect(() => resolveLineBindTokenConfig({ lineBindTokenSecret: SECRET, liffId: ' ' })).toThrow(
      'LINE bind token configuration is missing.',
    );
  });

  it('builds and rebuilds the same LIFF URL with an encoded token query', () => {
    const config = resolveLineBindTokenConfig({
      lineBindTokenSecret: SECRET,
      liffId: '1234567890-test',
    });
    const token = deriveLineBindPlaintextToken(TOKEN_ID, SECRET);

    const expectedUrl = `https://liff.line.me/1234567890-test/line/order-gate?t=${token}`;
    expect(buildLineBindLiffUrl(config.liffId, token)).toBe(expectedUrl);
    expect(rebuildLineBindLiffUrl(TOKEN_ID, config)).toEqual({
      plaintextToken: token,
      url: expectedUrl,
    });
  });
});

describe('LINE bind token state', () => {
  const now = new Date('2026-06-21T08:00:00.000Z');
  const baseRow = {
    expires_at: '2026-07-21T08:00:00.000Z',
    revoked_at: null,
    used_at: null,
  };

  it.each([
    ['pending', baseRow],
    ['used', { ...baseRow, used_at: '2026-06-21T07:00:00.000Z' }],
    ['revoked', { ...baseRow, revoked_at: '2026-06-21T07:00:00.000Z' }],
    ['expired', { ...baseRow, expires_at: '2026-06-21T07:59:59.999Z' }],
  ] as const)('derives %s', (expected, row) => {
    expect(deriveLineBindTokenState(row, now)).toBe(expected);
  });
});

describe('LINE bind token persistence service', () => {
  const config = resolveLineBindTokenConfig({
    lineBindTokenSecret: SECRET,
    liffId: '1234567890-test',
  });

  it('issues through the atomic RPC without sending or storing plaintext', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return {
          data: {
            created_at: '2026-06-21T08:00:00.000Z',
            created_by: 'admin-1',
            customer_id: 'customer-1',
            expires_at: '2026-07-21T08:00:00.000Z',
            id: TOKEN_ID,
            revoked_at: null,
            token_hash: args.p_token_hash,
            updated_at: '2026-06-21T08:00:00.000Z',
            used_at: null,
            work_order_id: 'work-order-1',
          },
          error: null,
        };
      },
    };

    const result = await issueLineBindToken(
      client as never,
      {
        createdBy: 'admin-1',
        customerId: 'customer-1',
        workOrderId: 'work-order-1',
      },
      config,
      TOKEN_ID,
    );

    const plaintextToken = deriveLineBindPlaintextToken(TOKEN_ID, SECRET);
    expect(calls).toEqual([
      {
        args: {
          p_created_by: 'admin-1',
          p_customer_id: 'customer-1',
          p_token_hash: hashLineBindToken(plaintextToken),
          p_token_id: TOKEN_ID,
          p_work_order_id: 'work-order-1',
        },
        name: 'issue_line_bind_token',
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain(plaintextToken);
    expect(result.plaintextToken).toBe(plaintextToken);
    expect(result.url).toContain(`?t=${plaintextToken}`);
    expect(
      new Date(result.row.expires_at).getTime() - new Date(result.row.created_at).getTime(),
    ).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('resolves token state by SHA-256 hash and returns invalid for no row', async () => {
    const token = deriveLineBindPlaintextToken(TOKEN_ID, SECRET);
    const requestedHashes: string[] = [];
    const createClient = (row: unknown) => ({
      from() {
        return {
          select() {
            return {
              eq(_column: string, hash: string) {
                requestedHashes.push(hash);
                return {
                  async maybeSingle() {
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      },
    });

    await expect(
      resolveLineBindToken(
        createClient({
          created_at: '2026-06-21T08:00:00.000Z',
          created_by: null,
          customer_id: 'customer-1',
          expires_at: '2026-07-21T08:00:00.000Z',
          id: TOKEN_ID,
          revoked_at: null,
          token_hash: hashLineBindToken(token),
          updated_at: '2026-06-21T08:00:00.000Z',
          used_at: null,
          work_order_id: 'work-order-1',
        }) as never,
        token,
        new Date('2026-06-21T08:00:00.000Z'),
      ),
    ).resolves.toMatchObject({ state: 'pending' });
    await expect(resolveLineBindToken(createClient(null) as never, token)).resolves.toEqual({
      row: null,
      state: 'invalid',
    });
    expect(requestedHashes).toEqual([hashLineBindToken(token), hashLineBindToken(token)]);
  });

  it('revokes pending tokens through the database RPC', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return { data: 2, error: null };
      },
    };

    await expect(revokePendingLineBindTokens(client as never, 'customer-1')).resolves.toBe(2);
    expect(calls).toEqual([
      {
        args: { p_customer_id: 'customer-1' },
        name: 'revoke_pending_line_bind_tokens',
      },
    ]);
  });
});
