import { describe, expect, it } from 'vitest';
import {
  getAdminRouteGuardRedirect,
  mapAdminSessionStatusCode,
  sanitizeAdminRedirect,
} from '../../app/utils/admin-session';

describe('admin session UI helpers', () => {
  it('sanitizes redirect targets to admin-relative paths only', () => {
    expect(sanitizeAdminRedirect('/admin')).toBe('/admin');
    expect(sanitizeAdminRedirect('/admin/work-orders?status=REPAIRING')).toBe(
      '/admin/work-orders?status=REPAIRING',
    );
    expect(sanitizeAdminRedirect('/admin#summary')).toBe('/admin#summary');

    expect(sanitizeAdminRedirect('https://example.com/admin')).toBe('/admin');
    expect(sanitizeAdminRedirect('//example.com/admin')).toBe('/admin');
    expect(sanitizeAdminRedirect('/login')).toBe('/admin');
    expect(sanitizeAdminRedirect('/foo')).toBe('/admin');
    expect(sanitizeAdminRedirect('/adminish')).toBe('/admin');
  });

  it('maps admin session HTTP status codes to resolved session states', () => {
    expect(mapAdminSessionStatusCode(401)).toEqual({
      profile: null,
      status: 'anonymous',
    });
    expect(mapAdminSessionStatusCode(403)).toEqual({
      profile: null,
      status: 'forbidden',
    });
    expect(mapAdminSessionStatusCode(500)).toBeNull();
  });

  it('creates admin route guard redirects from resolved session states', () => {
    expect(getAdminRouteGuardRedirect('admin', '/admin')).toBeNull();
    expect(getAdminRouteGuardRedirect('forbidden', '/admin/work-orders')).toBe('/forbidden');
    expect(getAdminRouteGuardRedirect('anonymous', '/admin/work-orders?page=2')).toEqual({
      path: '/login',
      query: {
        redirect: '/admin/work-orders?page=2',
      },
    });
  });
});
