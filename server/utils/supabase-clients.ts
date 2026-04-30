import type { H3Event } from 'h3';
import type {
  serverSupabaseClient,
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server';
import type { Database } from '../../types/database.types';

type ServerSupabaseServices = {
  serverSupabaseClient: typeof serverSupabaseClient;
  serverSupabaseServiceRole: typeof serverSupabaseServiceRole;
  serverSupabaseUser: typeof serverSupabaseUser;
};

let supabaseServerServicesPromise: Promise<ServerSupabaseServices> | undefined;

const loadSupabaseServerServices = async (): Promise<ServerSupabaseServices> => {
  supabaseServerServicesPromise ??= import('#supabase/server') as Promise<ServerSupabaseServices>;

  return supabaseServerServicesPromise;
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
  const { serverSupabaseServiceRole } = await loadSupabaseServerServices();
  return serverSupabaseServiceRole<Database>(event);
};

export type UserScopedSupabaseClient = Awaited<ReturnType<typeof getUserScopedSupabaseClient>>;
export type ServiceRoleSupabaseClient = Awaited<
  ReturnType<typeof getServiceRoleSupabaseClient>
>;

export type SupabaseUserClaims = Awaited<ReturnType<typeof getSupabaseUserClaims>>;
