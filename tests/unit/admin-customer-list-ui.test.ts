import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAdminCustomerListApiQuery,
  getAdminCustomerDetailPath,
  getCustomerLineStatusLabel,
  getCustomerLineStatusTone,
  normalizeAdminCustomerListRouteQuery,
  serializeAdminCustomerListQuery,
} from '../../app/utils/admin-customers';

const customerListPage = readFileSync(
  resolve(process.cwd(), 'app/pages/admin/customers/index.vue'),
  'utf8',
);
const adminLayout = readFileSync(resolve(process.cwd(), 'app/layouts/admin.vue'), 'utf8');

describe('admin customer list UI helpers', () => {
  it('normalizes customer list route query state and serializes canonical query values', () => {
    const normalized = normalizeAdminCustomerListRouteQuery({
      lineStatus: 'linked',
      page: '2',
      q: ' 王 ',
    });

    expect(normalized.query).toMatchObject({
      lineStatus: 'linked',
      page: 2,
      q: '王',
    });
    expect(serializeAdminCustomerListQuery(normalized.query)).toEqual({
      lineStatus: 'linked',
      page: '2',
      q: '王',
    });
  });

  it('builds the admin customers API query and customer path', () => {
    const normalized = normalizeAdminCustomerListRouteQuery({
      lineStatus: 'not_notifyable',
      page: '3',
      pageSize: '50',
      q: '0912',
      sort: 'workOrderCount:desc',
    });

    expect(buildAdminCustomerListApiQuery(normalized.query)).toEqual({
      lineStatus: 'not_notifyable',
      page: '3',
      pageSize: '50',
      q: '0912',
      sort: 'workOrderCount:desc',
    });
    expect(getAdminCustomerDetailPath('customer/id')).toBe('/admin/customers/customer%2Fid');
  });

  it('formats LINE status labels and tones', () => {
    expect(getCustomerLineStatusLabel({ linked: true, notifyStatus: 'notifyable' })).toBe(
      '已綁定，可通知',
    );
    expect(getCustomerLineStatusTone({ linked: true, notifyStatus: 'notifyable' })).toBe('success');
    expect(getCustomerLineStatusLabel({ linked: false, notifyStatus: 'unlinked' })).toBe('未綁定');
    expect(getCustomerLineStatusTone({ linked: false, notifyStatus: 'unlinked' })).toBe('muted');
  });

  it('adds the customer list page with API fetch, route guard, and visible table copy', () => {
    expect(customerListPage).toContain("title: '顧客管理 | BoardsReborn'");
    expect(customerListPage).toContain("middleware: ['admin-auth', 'admin-customers-query']");
    expect(customerListPage).toContain("'/api/admin/customers'");
    expect(customerListPage).toContain('getAdminRouteGuardRedirect');
    expect(customerListPage).toContain('顧客姓名');
    expect(customerListPage).toContain('LINE 狀態');
    expect(customerListPage).toContain('最新工單');
    expect(customerListPage).toContain('備註摘要');
  });

  it('adds customers to admin navigation near work orders', () => {
    expect(adminLayout).toContain('UsersIcon');
    expect(adminLayout).toContain("label: '顧客'");
    expect(adminLayout).toContain("to: '/admin/customers'");

    const workOrderIndex = adminLayout.indexOf("to: '/admin/work-orders'");
    const customerIndex = adminLayout.indexOf("to: '/admin/customers'");
    const printingIndex = adminLayout.indexOf("to: '/admin/printing'");

    expect(workOrderIndex).toBeGreaterThan(-1);
    expect(customerIndex).toBeGreaterThan(workOrderIndex);
    expect(customerIndex).toBeLessThan(printingIndex);
  });
});
