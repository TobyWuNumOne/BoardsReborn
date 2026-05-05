import { describe, expect, it } from 'vitest';
import {
  buildAdminWorkOrderStatusTransitionPayload,
  createEmptyAdminWorkOrderWorkFormState,
  isWorkOrderStatusBlockedForBoardType,
} from '../../app/utils/admin-work-orders';

describe('admin work-order work helpers', () => {
  it('requires status and always includes note in the payload', () => {
    const formState = createEmptyAdminWorkOrderWorkFormState();

    expect(buildAdminWorkOrderStatusTransitionPayload(formState)).toEqual({
      fieldErrors: {
        status: ['請選擇狀態。'],
      },
      payload: null,
    });

    formState.status = 'REPAIRING';
    formState.note = '   ';

    expect(buildAdminWorkOrderStatusTransitionPayload(formState)).toEqual({
      fieldErrors: {},
      payload: {
        note: null,
        status: 'REPAIRING',
      },
    });
  });

  it('trims note and only includes internalNote when it has a non-empty value', () => {
    const formState = createEmptyAdminWorkOrderWorkFormState();

    formState.status = 'READY_FOR_PICKUP';
    formState.note = '  已完成，等待取件  ';
    formState.internalNote = '  老闆已確認可取件  ';

    expect(buildAdminWorkOrderStatusTransitionPayload(formState)).toEqual({
      fieldErrors: {},
      payload: {
        internalNote: '老闆已確認可取件',
        note: '已完成，等待取件',
        status: 'READY_FOR_PICKUP',
      },
    });

    formState.internalNote = '   ';

    expect(buildAdminWorkOrderStatusTransitionPayload(formState)).toEqual({
      fieldErrors: {},
      payload: {
        note: '已完成，等待取件',
        status: 'READY_FOR_PICKUP',
      },
    });
  });

  it('marks SNOWBOARD -> DRYING as blocked in the frontend option layer', () => {
    expect(isWorkOrderStatusBlockedForBoardType('SNOWBOARD', 'DRYING')).toBe(true);
    expect(isWorkOrderStatusBlockedForBoardType('SNOWBOARD', 'REPAIRING')).toBe(false);
    expect(isWorkOrderStatusBlockedForBoardType('SURFBOARD', 'DRYING')).toBe(false);
  });
});
