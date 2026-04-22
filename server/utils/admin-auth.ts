import type { H3Event } from 'h3';
import { ForbiddenError, InternalServerError, UnauthorizedError } from './api-errors';
import {
  getSupabaseUserClaims,
  getUserScopedSupabaseClient,
  type SupabaseUserClaims,
  type UserScopedSupabaseClient,
} from './supabase-clients';
import type { Database } from '../../types/database.types';

export const ADMIN_PROFILE_SELECT = 'id, display_name';

export type AdminProfile = Pick<
  Database['public']['Tables']['admin_profiles']['Row'],
  'id' | 'display_name'
>;

export type AdminProfileLookupClient = Pick<UserScopedSupabaseClient, 'from'>;

export interface AdminAuthDependencies<
  Client extends AdminProfileLookupClient = UserScopedSupabaseClient,
> {
  getSupabaseClient?: (event: H3Event) => Promise<Client>;
  getSupabaseUser?: (event: H3Event) => Promise<SupabaseUserClaims>;
}

export interface AdminContext<Client extends AdminProfileLookupClient = UserScopedSupabaseClient> {
  profile: AdminProfile;
  supabase: Client;
  userId: string;
}

const getUserId = (claims: SupabaseUserClaims): string => {
  if (!claims?.sub || typeof claims.sub !== 'string') {
    throw new UnauthorizedError();
  }

  return claims.sub;
};

export const requireAdminContext = async <
  Client extends AdminProfileLookupClient = UserScopedSupabaseClient,
>(
  event: H3Event,
  dependencies: AdminAuthDependencies<Client> = {},
): Promise<AdminContext<Client>> => {
  const claims = await (dependencies.getSupabaseUser ?? getSupabaseUserClaims)(event);
  const userId = getUserId(claims);
  const supabase = await (
    dependencies.getSupabaseClient ??
    (getUserScopedSupabaseClient as unknown as (event: H3Event) => Promise<Client>)
  )(event);

  const { data: profile, error } = await supabase
    .from('admin_profiles')
    .select(ADMIN_PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new InternalServerError('Unable to verify admin access.');
  }

  if (!profile) {
    throw new ForbiddenError('Admin access required.');
  }

  return {
    profile,
    supabase,
    userId,
  };
};
