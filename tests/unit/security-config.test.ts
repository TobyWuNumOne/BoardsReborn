import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('security configuration', () => {
  it('sets baseline security headers and same-site auth cookies in Nuxt config', () => {
    const source = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8');

    for (const expected of [
      'Content-Security-Policy',
      "frame-ancestors 'none'",
      'Referrer-Policy',
      'no-referrer',
      'X-Content-Type-Options',
      'nosniff',
      'X-Frame-Options',
      'DENY',
      'Permissions-Policy',
      "sameSite: 'lax'",
    ]) {
      expect(source).toContain(expected);
    }
  });

  it('keeps public lookup responses out of shared and browser caches', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/public/work-orders/lookup.post.ts'),
      'utf8',
    );

    expect(source).toContain("setHeader(event, 'Cache-Control', 'no-store, private')");
  });
});
