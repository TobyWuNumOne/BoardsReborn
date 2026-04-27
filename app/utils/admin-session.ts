export interface AdminSessionProfile {
  displayName: string | null;
  id: string;
}

export interface AdminSessionResponse {
  data: AdminSessionProfile;
}

export type AdminSessionResolvedStatus = 'admin' | 'anonymous' | 'forbidden';
export type AdminSessionStatus = 'loading' | AdminSessionResolvedStatus;

export interface AdminSessionSnapshot {
  profile: AdminSessionProfile | null;
  status: AdminSessionResolvedStatus;
}

export const DEFAULT_ADMIN_REDIRECT = '/admin';

export const sanitizeAdminRedirect = (value: unknown): string => {
  if (typeof value !== 'string') {
    return DEFAULT_ADMIN_REDIRECT;
  }

  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    !trimmedValue.startsWith('/') ||
    trimmedValue.startsWith('//') ||
    trimmedValue.includes('://')
  ) {
    return DEFAULT_ADMIN_REDIRECT;
  }

  const pathOnly = trimmedValue.split(/[?#]/, 1)[0] ?? '';

  if (pathOnly !== '/admin' && !pathOnly.startsWith('/admin/')) {
    return DEFAULT_ADMIN_REDIRECT;
  }

  return trimmedValue;
};

export const mapAdminSessionStatusCode = (
  statusCode: number | undefined,
): AdminSessionSnapshot | null => {
  if (statusCode === 401) {
    return {
      profile: null,
      status: 'anonymous',
    };
  }

  if (statusCode === 403) {
    return {
      profile: null,
      status: 'forbidden',
    };
  }

  return null;
};

export const getAdminRouteGuardRedirect = (
  status: AdminSessionResolvedStatus,
  currentPath: string,
) => {
  if (status === 'anonymous') {
    return {
      path: '/login',
      query: {
        redirect: sanitizeAdminRedirect(currentPath),
      },
    };
  }

  if (status === 'forbidden') {
    return '/forbidden';
  }

  return null;
};
