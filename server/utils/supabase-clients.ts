import type { H3Event } from 'h3';
import type {
  serverSupabaseClient,
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server';
import type { Database } from '../../types/database.types';
import { InternalServerError } from './api-errors';

type ServerSupabaseServices = {
  serverSupabaseClient: typeof serverSupabaseClient;
  serverSupabaseServiceRole: typeof serverSupabaseServiceRole;
  serverSupabaseUser: typeof serverSupabaseUser;
};

type RuntimeImports = {
  useRuntimeConfig: (event?: H3Event) => {
    public: {
      supabase: {
        key?: string;
        url?: string;
      };
    };
    supabase?: {
      secretKey?: string;
      serviceKey?: string;
    };
    supabaseSecretKey?: string;
  };
};

let supabaseServerServicesPromise: Promise<ServerSupabaseServices> | undefined;
let runtimeImportsPromise: Promise<RuntimeImports> | undefined;

type ServiceRoleCredentialsInput = {
  env?: NodeJS.ProcessEnv;
  publicSupabaseKey?: string;
  runtimeSupabaseSecretKey?: string;
  runtimeSupabaseUrl?: string;
};

const readFirstNonEmpty = (...values: Array<string | undefined | null>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const tryDecodeSupabaseJwtRole = (key: string): string | null => {
  const segments = key.split('.');

  if (segments.length !== 3) {
    return null;
  }

  const payloadSegment = segments[1];

  if (!payloadSegment) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
      role?: unknown;
    };

    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
};

const isMisconfiguredPublicSupabaseKey = (key: string, publicSupabaseKey?: string): boolean => {
  if (publicSupabaseKey && key === publicSupabaseKey) {
    return true;
  }

  if (key.startsWith('sb_publishable_')) {
    return true;
  }

  const jwtRole = tryDecodeSupabaseJwtRole(key);
  return jwtRole === 'anon' || jwtRole === 'authenticated';
};

export const resolveServiceRoleSupabaseCredentials = ({
  env = process.env,
  publicSupabaseKey,
  runtimeSupabaseSecretKey,
  runtimeSupabaseUrl,
}: ServiceRoleCredentialsInput) => {
  const url = readFirstNonEmpty(env.NUXT_PUBLIC_SUPABASE_URL, env.SUPABASE_URL, runtimeSupabaseUrl);
  const secretKey = readFirstNonEmpty(
    env.NUXT_SUPABASE_SECRET_KEY,
    env.SUPABASE_SECRET_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
    runtimeSupabaseSecretKey,
  );

  if (!url || !secretKey) {
    throw new InternalServerError();
  }

  if (isMisconfiguredPublicSupabaseKey(secretKey, publicSupabaseKey)) {
    throw new InternalServerError();
  }

  return { secretKey, url };
};

const loadSupabaseServerServices = async (): Promise<ServerSupabaseServices> => {
  supabaseServerServicesPromise ??= import('#supabase/server') as Promise<ServerSupabaseServices>;

  return supabaseServerServicesPromise;
};

const loadRuntimeImports = async (): Promise<RuntimeImports> => {
  runtimeImportsPromise ??= import('#imports') as Promise<RuntimeImports>;

  return runtimeImportsPromise;
};

export const getUserScopedSupabaseClient = async (event: H3Event) => {
  const { serverSupabaseClient } = await loadSupabaseServerServices();
  return serverSupabaseClient<Database>(event);
};

export const getSupabaseUserClaims = async (event: H3Event) => {
  const { serverSupabaseUser } = await loadSupabaseServerServices();
  return serverSupabaseUser(event);
};

export const getServiceRoleSupabaseClient = async (event: H3Event) => {
  const { useRuntimeConfig } = await loadRuntimeImports();
  const config = useRuntimeConfig(event);
  const { secretKey, url } = resolveServiceRoleSupabaseCredentials({
    publicSupabaseKey: config.public.supabase.key,
    runtimeSupabaseSecretKey:
      config.supabaseSecretKey || config.supabase?.secretKey || config.supabase?.serviceKey,
    runtimeSupabaseUrl: config.public.supabase.url,
  });
  const { serverSupabaseServiceRole } = await loadSupabaseServerServices();

  config.public.supabase.url = url;
  config.supabase = {
    ...config.supabase,
    secretKey,
  };

  return serverSupabaseServiceRole<Database>(event);
};

export type UserScopedSupabaseClient = Awaited<ReturnType<typeof getUserScopedSupabaseClient>>;
export type ServiceRoleSupabaseClient = Awaited<ReturnType<typeof getServiceRoleSupabaseClient>>;

export type SupabaseUserClaims = Awaited<ReturnType<typeof getSupabaseUserClaims>>;
