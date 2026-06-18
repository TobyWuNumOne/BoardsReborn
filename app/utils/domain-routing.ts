export interface DomainRedirect {
  external: boolean;
  location: string;
  redirectCode: 302;
}

interface ResolveDomainRedirectInput {
  adminUrl: string;
  currentUrl: string;
  statusUrl: string;
}

const isPathWithin = (path: string, basePath: string) =>
  path === basePath || path.startsWith(`${basePath}/`);

const parseHttpUrl = (value: string) => {
  try {
    const url = new URL(value);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url;
  } catch {
    return null;
  }
};

const createRedirect = (location: string, external: boolean): DomainRedirect => ({
  external,
  location,
  redirectCode: 302,
});

const appendCurrentRoute = (origin: string, currentUrl: URL) =>
  `${origin}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;

export const resolveDomainRedirect = ({
  adminUrl,
  currentUrl,
  statusUrl,
}: ResolveDomainRedirectInput): DomainRedirect | null => {
  const admin = parseHttpUrl(adminUrl);
  const current = parseHttpUrl(currentUrl);
  const status = parseHttpUrl(statusUrl);

  if (!admin || !current || !status) {
    return null;
  }

  const adminHostname = admin.hostname.toLowerCase();
  const currentHostname = current.hostname.toLowerCase();
  const statusHostname = status.hostname.toLowerCase();
  const rootHostname = statusHostname.startsWith('status.')
    ? statusHostname.slice('status.'.length)
    : null;
  const hasMatchingProductionDomains =
    rootHostname !== null && adminHostname === `admin.${rootHostname}`;
  const isAdminPath = isPathWithin(current.pathname, '/admin');
  const isAdminAccessPath =
    isAdminPath || current.pathname === '/login' || current.pathname === '/forbidden';
  const isPublicLookupPath = isPathWithin(current.pathname, '/repair-status');

  if (currentHostname === adminHostname) {
    if (current.pathname === '/') {
      return createRedirect(`/admin${current.search}${current.hash}`, false);
    }

    if (isAdminAccessPath) {
      return null;
    }

    if (isPublicLookupPath) {
      return createRedirect(appendCurrentRoute(status.origin, current), true);
    }

    return createRedirect('/admin', false);
  }

  if (currentHostname === statusHostname) {
    if (current.pathname === '/') {
      return createRedirect(`/repair-status${current.search}${current.hash}`, false);
    }

    if (isPublicLookupPath) {
      return null;
    }

    if (isAdminAccessPath) {
      return createRedirect(appendCurrentRoute(admin.origin, current), true);
    }

    return createRedirect('/repair-status', false);
  }

  if (
    hasMatchingProductionDomains &&
    (currentHostname === rootHostname || currentHostname === `www.${rootHostname}`)
  ) {
    if (isAdminAccessPath) {
      return createRedirect(appendCurrentRoute(admin.origin, current), true);
    }

    if (isPublicLookupPath) {
      return createRedirect(appendCurrentRoute(status.origin, current), true);
    }

    return createRedirect(`${status.origin}/repair-status`, true);
  }

  return null;
};
