import { describe, expect, it } from 'vitest';
import { InternalServerError } from '../../server/utils/api-errors';
import { resolveServiceRoleSupabaseCredentials } from '../../server/utils/supabase-clients';

describe('resolveServiceRoleSupabaseCredentials', () => {
  it('prefers runtime env values for the service-role client', () => {
    expect(
      resolveServiceRoleSupabaseCredentials({
        env: {
          NUXT_PUBLIC_SUPABASE_URL: 'https://env-project.supabase.co',
          NUXT_SUPABASE_SECRET_KEY: 'sb_secret_runtime_value',
        },
        publicSupabaseKey: 'sb_publishable_public_value',
        runtimeSupabaseSecretKey: 'sb_secret_runtime_config_value',
        runtimeSupabaseUrl: 'https://config-project.supabase.co',
      }),
    ).toEqual({
      secretKey: 'sb_secret_runtime_value',
      url: 'https://env-project.supabase.co',
    });
  });

  it('falls back to runtime config values when env vars are not present', () => {
    expect(
      resolveServiceRoleSupabaseCredentials({
        env: {},
        publicSupabaseKey: 'sb_publishable_public_value',
        runtimeSupabaseSecretKey: 'sb_secret_runtime_config_value',
        runtimeSupabaseUrl: 'https://config-project.supabase.co',
      }),
    ).toEqual({
      secretKey: 'sb_secret_runtime_config_value',
      url: 'https://config-project.supabase.co',
    });
  });

  it('rejects a public key being used as the server-side key', () => {
    expect(() =>
      resolveServiceRoleSupabaseCredentials({
        env: {
          SUPABASE_SECRET_KEY: 'sb_publishable_public_value',
          SUPABASE_URL: 'https://env-project.supabase.co',
        },
        publicSupabaseKey: 'sb_publishable_public_value',
      }),
    ).toThrow(InternalServerError);
  });

  it('rejects legacy jwt keys whose role is anon or authenticated', () => {
    const encodeJwtPayload = (payload: object) =>
      `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

    expect(() =>
      resolveServiceRoleSupabaseCredentials({
        env: {
          SUPABASE_SECRET_KEY: encodeJwtPayload({ role: 'anon' }),
          SUPABASE_URL: 'https://env-project.supabase.co',
        },
        publicSupabaseKey: 'different-public-key',
      }),
    ).toThrow(InternalServerError);

    expect(() =>
      resolveServiceRoleSupabaseCredentials({
        env: {
          SUPABASE_SECRET_KEY: encodeJwtPayload({ role: 'authenticated' }),
          SUPABASE_URL: 'https://env-project.supabase.co',
        },
        publicSupabaseKey: 'different-public-key',
      }),
    ).toThrow(InternalServerError);
  });
});
