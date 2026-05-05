import { describe, expect, it } from 'vitest';
import {
  getAdminWorkOrderDetailAsyncKey,
  getAdminWorkOrderDetailModeLabel,
  getAdminWorkOrderDetailPath,
  normalizeAdminWorkOrderDetailRouteQuery,
} from '../../app/utils/admin-work-orders';

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
});
