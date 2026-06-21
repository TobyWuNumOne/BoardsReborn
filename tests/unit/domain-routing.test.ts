import { describe, expect, it } from 'vitest';
import { resolveDomainRedirect } from '../../app/utils/domain-routing';

const routingConfig = {
  adminUrl: 'https://admin.surfboards-reborn.com',
  statusUrl: 'https://status.surfboards-reborn.com',
};

describe('domain routing', () => {
  it('routes the admin root without intercepting admin authentication pages', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/',
      }),
    ).toEqual({ external: false, location: '/admin', redirectCode: 302 });

    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/login?redirect=%2Fadmin',
      }),
    ).toBeNull();
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/forbidden',
      }),
    ).toBeNull();
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/admin/work-orders',
      }),
    ).toBeNull();
  });

  it('moves public lookup paths from the admin domain and preserves path, query, and hash', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/repair-status/history?source=old#lookup',
      }),
    ).toEqual({
      external: true,
      location: 'https://status.surfboards-reborn.com/repair-status/history?source=old#lookup',
      redirectCode: 302,
    });
  });

  it('allows public lookup paths on the status domain and routes admin pages away', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://status.surfboards-reborn.com/repair-status',
      }),
    ).toBeNull();
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://status.surfboards-reborn.com/repair-status/history?source=qr',
      }),
    ).toBeNull();
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://status.surfboards-reborn.com/admin/work-orders?page=2#results',
      }),
    ).toEqual({
      external: true,
      location: 'https://admin.surfboards-reborn.com/admin/work-orders?page=2#results',
      redirectCode: 302,
    });
  });

  it('allows the LINE order gate on the status domain without consuming its token query', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://status.surfboards-reborn.com/line/order-gate',
      }),
    ).toBeNull();
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://status.surfboards-reborn.com/line/order-gate?t=bind-token#confirm',
      }),
    ).toBeNull();
  });

  it('keeps the LINE order gate status-only without changing admin or root routing', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://admin.surfboards-reborn.com/line/order-gate?t=bind-token',
      }),
    ).toEqual({ external: false, location: '/admin', redirectCode: 302 });
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://surfboards-reborn.com/line/order-gate?t=bind-token',
      }),
    ).toEqual({
      external: true,
      location: 'https://status.surfboards-reborn.com/repair-status',
      redirectCode: 302,
    });
  });

  it('routes root and www domains while preserving legacy lookup path queries', () => {
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://surfboards-reborn.com/',
      }),
    ).toEqual({
      external: true,
      location: 'https://status.surfboards-reborn.com/repair-status',
      redirectCode: 302,
    });
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://www.surfboards-reborn.com/repair-status?source=legacy',
      }),
    ).toEqual({
      external: true,
      location: 'https://status.surfboards-reborn.com/repair-status?source=legacy',
      redirectCode: 302,
    });
    expect(
      resolveDomainRedirect({
        ...routingConfig,
        currentUrl: 'https://surfboards-reborn.com/admin/scan?mode=fast',
      }),
    ).toEqual({
      external: true,
      location: 'https://admin.surfboards-reborn.com/admin/scan?mode=fast',
      redirectCode: 302,
    });
  });

  it('does not route localhost, preview, or unrecognized hosts', () => {
    for (const currentUrl of [
      'http://localhost:3000/admin',
      'https://board-reborn-staging.vercel.app/repair-status',
      'https://feature-board-reborn.vercel.app/admin',
    ]) {
      expect(resolveDomainRedirect({ ...routingConfig, currentUrl })).toBeNull();
    }
  });

  it('normalizes configured URLs and current host ports and casing', () => {
    expect(
      resolveDomainRedirect({
        adminUrl: 'https://ADMIN.surfboards-reborn.com/',
        currentUrl: 'https://ADMIN.SURFBOARDS-REBORN.COM:443/',
        statusUrl: 'https://STATUS.surfboards-reborn.com/',
      }),
    ).toEqual({ external: false, location: '/admin', redirectCode: 302 });
  });
});
