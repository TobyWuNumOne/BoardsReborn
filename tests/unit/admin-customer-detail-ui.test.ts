import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildAdminCustomerDetailApiQuery,
  getAdminCustomerDetailAsyncKey,
  getAdminCustomerDetailPath,
  normalizeAdminCustomerDetailRouteQuery,
} from '../../app/utils/admin-customers';
import { getAdminWorkOrderDetailPath } from '../../app/utils/admin-work-orders';

const customerDetailPage = readFileSync(
  resolve(process.cwd(), 'app/pages/admin/customers/[id].vue'),
  'utf8',
);
const customerDetailMiddleware = readFileSync(
  resolve(process.cwd(), 'app/middleware/admin-customer-detail-query.ts'),
  'utf8',
);

describe('admin customer detail UI helpers', () => {
  it('normalizes customer detail route query state and builds the API query', () => {
    const normalized = normalizeAdminCustomerDetailRouteQuery({
      page: '2',
      pageSize: '50',
    });

    expect(normalized).toEqual({
      canonicalQuery: {
        page: '2',
        pageSize: '50',
      },
      needsReplace: false,
      query: {
        page: 2,
        pageSize: 50,
      },
    });
    expect(buildAdminCustomerDetailApiQuery(normalized.query)).toEqual({
      page: '2',
      pageSize: '50',
    });
    expect(getAdminCustomerDetailAsyncKey('customer-1', normalized.query)).toBe(
      'admin-customer-detail:customer-1:2:50',
    );
    expect(getAdminCustomerDetailPath('customer/id')).toBe('/admin/customers/customer%2Fid');
    expect(getAdminWorkOrderDetailPath('work-order-1')).toBe(
      '/admin/work-orders/work-order-1?mode=view',
    );
  });

  it('renders the customer detail page with customer, LINE, transfer, and work-order contract copy', () => {
    expect(customerDetailPage).toContain("title: '顧客詳情 | BoardsReborn'");
    expect(customerDetailPage).toContain("middleware: ['admin-auth', 'admin-customer-detail-query']");
    expect(customerDetailPage).toContain('顧客詳情');
    expect(customerDetailPage).toContain('顧客 profile');
    expect(customerDetailPage).toContain('LINE 管理');
    expect(customerDetailPage).toContain('轉移工單');
    expect(customerDetailPage).toContain('發卡');
    expect(customerDetailPage).toContain('解除綁定');
    expect(customerDetailPage).toContain('查看工單詳情');
    expect(customerDetailPage).toContain('copyIssuedLiffUrl');
    expect(customerDetailPage).toContain('/api/admin/customers/${encodeURIComponent(routeCustomerId.value)}');
    expect(customerDetailPage).toContain("method: 'PATCH'");
    expect(customerDetailPage).toContain('/line-bind-token');
    expect(customerDetailPage).toContain('/line-binding');
    expect(customerDetailPage).toContain('/transfer-customer');
    expect(customerDetailPage).toContain('getAdminWorkOrderDetailPath');
    expect(customerDetailPage).toContain('navigator.clipboard.writeText');
    expect(customerDetailPage).toContain(
      'if (lastSuccessfulDetailRequestKey.value !== detailRequestKey.value) {',
    );
    expect(customerDetailPage).toContain(
      'payload && payload.requestKey === detailRequestKey.value',
    );
    expect(customerDetailPage).toContain(
      'payload && payload.requestKey === transferSearchRequestKey.value',
    );
    expect(customerDetailPage).toContain('transferCandidateResponse.value.response.data');
  });

  it('normalizes the customer detail route query in middleware', () => {
    expect(customerDetailMiddleware).toContain('normalizeAdminCustomerDetailRouteQuery');
    expect(customerDetailMiddleware).toContain('replace: true');
    expect(customerDetailMiddleware).toContain('query: normalized.canonicalQuery');
  });
});
