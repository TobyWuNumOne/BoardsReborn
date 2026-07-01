import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getAdminWorkOrderDetailAsyncKey,
  getAdminWorkOrderDetailModeLabel,
  getAdminWorkOrderDetailPath,
  normalizeAdminWorkOrderDetailRouteQuery,
} from '../../app/utils/admin-work-orders';

const detailPageSource = readFileSync(
  fileURLToPath(new URL('../../app/pages/admin/work-orders/[id].vue', import.meta.url)),
  'utf8',
);

describe('admin work-order detail UI helpers', () => {
  it('canonicalizes missing or invalid detail mode to view', () => {
    const missingMode = normalizeAdminWorkOrderDetailRouteQuery({});
    const invalidMode = normalizeAdminWorkOrderDetailRouteQuery({
      foo: 'bar',
      mode: 'broken',
    });

    expect(missingMode).toEqual({
      canonicalQuery: {
        mode: 'view',
      },
      mode: 'view',
      needsReplace: true,
    });
    expect(invalidMode).toEqual({
      canonicalQuery: {
        mode: 'view',
      },
      mode: 'view',
      needsReplace: true,
    });
  });

  it('keeps valid detail mode and path helpers explicit', () => {
    const normalized = normalizeAdminWorkOrderDetailRouteQuery({
      mode: 'work',
    });

    expect(normalized).toEqual({
      canonicalQuery: {
        mode: 'work',
      },
      mode: 'work',
      needsReplace: false,
    });
    expect(getAdminWorkOrderDetailPath('work-order-1')).toBe(
      '/admin/work-orders/work-order-1?mode=view',
    );
    expect(getAdminWorkOrderDetailPath('work-order-1', 'edit')).toBe(
      '/admin/work-orders/work-order-1?mode=edit',
    );
    expect(getAdminWorkOrderDetailModeLabel('view')).toBe('檢視');
  });

  it('keys detail async data only by work order id', () => {
    expect(getAdminWorkOrderDetailAsyncKey('work-order-1')).toBe(
      'admin-work-order-detail:work-order-1',
    );
    expect(getAdminWorkOrderDetailAsyncKey('work-order-1')).toBe(
      getAdminWorkOrderDetailAsyncKey('work-order-1'),
    );
  });

  it('loads detail and print summary lazily so navigation can show skeletons first', () => {
    expect(detailPageSource).toContain('lazy: true');
    expect(detailPageSource).toMatch(
      /useAsyncData\(detailAsyncKey,\s*fetchWorkOrderDetail,\s*\{\s*lazy: true,/s,
    );
    expect(detailPageSource).toMatch(
      /useAsyncData\(\s*computed\(\(\) => `admin-print-summary:\$\{routeWorkOrderId\.value\}`\),\s*fetchPrintSummary,\s*\{\s*lazy: true,/s,
    );
    expect(detailPageSource).toContain('v-if="isInitialLoading"');
  });

  it('does not let DOM events bypass unpaid delivery confirmation', () => {
    expect(detailPageSource).toContain('bypassConfirmation === true');
    expect(detailPageSource).not.toContain('if (bypassConfirmation ||');
    expect(detailPageSource).toContain('@click="() => submitPickupQuickAction()"');
    expect(detailPageSource).toContain('@click="() => submitWorkForm()"');
    expect(detailPageSource).not.toContain('@click="submitPickupQuickAction"');
    expect(detailPageSource).not.toContain('@click="submitWorkForm"');
  });
});
