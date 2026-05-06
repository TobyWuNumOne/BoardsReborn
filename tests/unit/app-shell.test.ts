import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appShell = readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8');

describe('app shell', () => {
  it('renders client-driven toast notifications only after hydration', () => {
    expect(appShell).toContain('<ClientOnly>');
    expect(appShell).toContain('<Toaster position="top-right" rich-colors />');
    expect(appShell.indexOf('<ClientOnly>')).toBeLessThan(
      appShell.indexOf('<Toaster position="top-right" rich-colors />'),
    );
    expect(appShell.indexOf('</ClientOnly>')).toBeGreaterThan(
      appShell.indexOf('<Toaster position="top-right" rich-colors />'),
    );
  });
});
