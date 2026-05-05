import { describe, expect, it } from 'vitest';
import {
  buildAdminWorkOrderEditPatchPayload,
  createAdminWorkOrderEditFormState,
  getAdminWorkOrderEditDirtyFields,
  normalizeAdminWorkOrderEditFormState,
  type AdminWorkOrderDetailItem,
} from '../../app/utils/admin-work-orders';

const detailFixture: AdminWorkOrderDetailItem = {
  board: {
    boardLengthClass: 'SHORTBOARD',
    boardType: 'SURFBOARD',
    brand: 'CI',
    color: 'White',
    model: 'Happy',
    serialLabel: 'A12',
    sizeLabel: "6'2",
  },
  currentStatus: 'REPAIRING',
  customer: {
    id: 'customer-1',
    name: '王小明',
    phone: '0912345678',
  },
  damageDescription: null,
  estimatedCompletionDate: '2026-04-30',
  id: 'work-order-1',
  intakeDate: '2026-04-20',
  internalNote: ' 內部備註 ',
  paperOrderNo: 'BR-2026-0001',
  paymentReceived: false,
  paymentReceivedAt: null,
  pickupInfo: {
    daysWaitingForPickup: 0,
    isPickupOverdue: false,
    notifiedAt: null,
    pickedUpAt: null,
    pickupNote: null,
    storageFeeWarningAfterDays: 14,
  },
  publicNote: '公開備註',
  quoteItems: [],
  quoteTotalAmount: 500,
  statusHistory: [],
};

describe('admin work-order edit helpers', () => {
  it('treats null, empty, and whitespace-only nullable text as equivalent', () => {
    const formState = createAdminWorkOrderEditFormState(detailFixture);
    const baseline = normalizeAdminWorkOrderEditFormState(formState);

    formState.damageDescription = '   ';
    formState.internalNote = '內部備註';
    formState.publicNote = ' 公開備註 ';
    formState.pickupNote = '';

    const current = normalizeAdminWorkOrderEditFormState(formState);

    expect(getAdminWorkOrderEditDirtyFields(baseline, current)).toEqual([]);
  });

  it('returns no payload when there are no dirty fields', () => {
    const formState = createAdminWorkOrderEditFormState(detailFixture);
    const baseline = normalizeAdminWorkOrderEditFormState(formState);
    const current = normalizeAdminWorkOrderEditFormState(formState);

    expect(getAdminWorkOrderEditDirtyFields(baseline, current)).toEqual([]);
    expect(buildAdminWorkOrderEditPatchPayload(baseline, current)).toEqual({
      dirtyFields: [],
      fieldErrors: {},
      payload: {},
    });
  });

  it('builds PATCH payload from normalized dirty fields only', () => {
    const formState = createAdminWorkOrderEditFormState(detailFixture);
    const baseline = normalizeAdminWorkOrderEditFormState(formState);

    formState.estimatedCompletionDate = '';
    formState.damageDescription = ' 拆開後確認範圍更大 ';
    formState.paymentReceived = true;
    formState.storageFeeWarningAfterDays = '21';

    const current = normalizeAdminWorkOrderEditFormState(formState);
    const result = buildAdminWorkOrderEditPatchPayload(baseline, current);

    expect(result.fieldErrors).toEqual({});
    expect(result.payload).toEqual({
      damageDescription: '拆開後確認範圍更大',
      estimatedCompletionDate: null,
      paymentReceived: true,
      storageFeeWarningAfterDays: 21,
    });
    expect(Object.keys(result.payload)).not.toContain('currentStatus');
    expect(Object.keys(result.payload)).not.toContain('customerId');
    expect(Object.keys(result.payload)).not.toContain('paperOrderNo');
  });

  it('keeps storageFeeWarningAfterDays as string in form state and validates before payload build', () => {
    const formState = createAdminWorkOrderEditFormState(detailFixture);
    const baseline = normalizeAdminWorkOrderEditFormState(formState);

    expect(typeof formState.storageFeeWarningAfterDays).toBe('string');

    formState.storageFeeWarningAfterDays = '  ';

    const current = normalizeAdminWorkOrderEditFormState(formState);
    const result = buildAdminWorkOrderEditPatchPayload(baseline, current);

    expect(result.payload).toEqual({});
    expect(result.fieldErrors).toEqual({
      storageFeeWarningAfterDays: ['請輸入正整數天數。'],
    });
  });
});
