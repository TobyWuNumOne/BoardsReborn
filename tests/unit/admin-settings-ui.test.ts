import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const adminLayout = readFileSync(resolve(process.cwd(), 'app/layouts/admin.vue'), 'utf8');
const createPage = readFileSync(
  resolve(process.cwd(), 'app/pages/admin/work-orders/new.vue'),
  'utf8',
);
const settingsPagePath = resolve(process.cwd(), 'app/pages/admin/settings.vue');
const settingsPage = existsSync(settingsPagePath) ? readFileSync(settingsPagePath, 'utf8') : '';

describe('admin settings and test work-order UI', () => {
  it('adds settings to the sidebar without adding it to the compact top navigation', () => {
    expect(adminLayout).toContain('SettingsIcon');
    expect(adminLayout).toContain("label: '後台設定'");
    expect(adminLayout).toContain("to: '/admin/settings'");

    const topNavBlock = adminLayout.slice(
      adminLayout.indexOf('const topNavItems'),
      adminLayout.indexOf('const isTopNavActive'),
    );
    expect(topNavBlock).not.toContain('/admin/settings');
  });

  it('provides a settings-page entry to the shared create form in test mode', () => {
    expect(settingsPage).toContain('後台設定');
    expect(settingsPage).toContain('測試工單');
    expect(settingsPage).toContain('/admin/work-orders/new?mode=test');
  });

  it('makes the 99 number editable and warns that test orders really print', () => {
    expect(createPage).toContain("normalizeAdminWorkOrderCreateMode(route.query)");
    expect(createPage).toContain("query: { mode: paperOrderMode.value }");
    expect(createPage).toContain('v-model="form.paperOrderNo"');
    expect(createPage).toContain('新增測試工單');
    expect(createPage).toContain('會建立真實工單並送出列印任務');
  });
});
