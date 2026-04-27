import type {
  AdminSessionProfile,
  AdminSessionResponse,
  AdminSessionSnapshot,
  AdminSessionStatus,
} from '~/utils/admin-session';
import { mapAdminSessionStatusCode } from '~/utils/admin-session';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

type AdminSessionNuxtApp = ReturnType<typeof useNuxtApp> & {
  _adminSessionPromise?: Promise<AdminSessionSnapshot>;
};

const getErrorStatusCode = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if (
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }

  return undefined;
};

const getSessionFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as RequestFetch;
};

const toSnapshot = (
  status: Exclude<AdminSessionStatus, 'loading'>,
  profile: AdminSessionProfile | null,
): AdminSessionSnapshot => ({
  profile,
  status,
});

export const useAdminSession = () => {
  const nuxtApp = useNuxtApp() as AdminSessionNuxtApp;
  const supabase = useSupabaseClient();
  const status = useState<AdminSessionStatus>('admin-session-status', () => 'loading');
  const profile = useState<AdminSessionProfile | null>('admin-session-profile', () => null);
  const initialized = useState<boolean>('admin-session-initialized', () => false);

  const applySnapshot = (snapshot: AdminSessionSnapshot) => {
    status.value = snapshot.status;
    profile.value = snapshot.profile;
    initialized.value = true;
    return snapshot;
  };

  const getCurrentSnapshot = (): AdminSessionSnapshot => {
    if (status.value === 'loading') {
      return {
        profile: null,
        status: 'anonymous',
      };
    }

    return toSnapshot(status.value, profile.value);
  };

  const refreshAdminSession = async (options: { force?: boolean } = {}) => {
    if (!options.force && initialized.value && status.value !== 'loading') {
      return getCurrentSnapshot();
    }

    if (nuxtApp._adminSessionPromise) {
      return nuxtApp._adminSessionPromise;
    }

    nuxtApp._adminSessionPromise = (async () => {
      status.value = 'loading';

      try {
        const response = await getSessionFetch()<AdminSessionResponse>('/api/admin/session');

        return applySnapshot({
          profile: response.data,
          status: 'admin',
        });
      } catch (error) {
        const fallbackSnapshot = mapAdminSessionStatusCode(getErrorStatusCode(error));

        if (fallbackSnapshot) {
          return applySnapshot(fallbackSnapshot);
        }

        status.value = 'loading';
        throw error;
      }
    })();

    try {
      return await nuxtApp._adminSessionPromise;
    } finally {
      nuxtApp._adminSessionPromise = undefined;
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      applySnapshot({
        profile: null,
        status: 'anonymous',
      });
    }

    return error;
  };

  return {
    initialized: readonly(initialized),
    profile: readonly(profile),
    refreshAdminSession,
    signInWithPassword,
    signOut,
    status: readonly(status),
  };
};
