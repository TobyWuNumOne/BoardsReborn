import { describe, expect, it } from 'vitest';
import {
  buildAdminWorkOrderCreatePayload,
  createAdminWorkOrderCreateInitialFormState,
  getFixedNextSundayDateString,
  getAdminWorkOrderCreateBoardColorButtonClassName,
  hasAdminWorkOrderCreateUnsavedChanges,
  normalizeAdminWorkOrderCreateFormState,
  resolveAdminCustomerLookupCandidates,
  shouldAutoLookupCustomerPhone,
  shouldResetCustomerLookupResolution,
} from '../../app/utils/admin-work-order-create';

describe('admin work-order create helpers', () => {
  it('defaults estimated completion date from intake date to the following Sunday cycle', () => {
    expect(getFixedNextSundayDateString('2026-04-27')).toBe('2026-05-10');
    expect(getFixedNextSundayDateString('2026-05-03')).toBe('2026-05-10');

    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    expect(formState.intakeDate).toBe('2026-04-29');
    expect(formState.estimatedCompletionDate).toBe('2026-05-10');
  });

  it('builds create payload for new customers and omits quote items when initial quote is blank', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    formState.paperOrderNo = 'BR-2026-0001';
    formState.customerPhone = '0912-345-678';
    formState.customerModeDecision = 'create';
    formState.customerName = '王小明';
    formState.boardType = 'SURFBOARD';
    formState.boardLengthClass = 'SHORTBOARD';
    formState.boardBrand = 'Channel Islands';
    formState.damageDescription = '鼻頭裂傷';
    formState.paymentReceived = true;

    const result = buildAdminWorkOrderCreatePayload(formState);

    expect(result.fieldErrors).toEqual({});
    expect(result.payload).toEqual({
      board: {
        boardLengthClass: 'SHORTBOARD',
        boardType: 'SURFBOARD',
        brand: 'Channel Islands',
      },
      customer: {
        name: '王小明',
        phone: '0912345678',
      },
      customerMode: 'create',
      quoteItems: [],
      workOrder: {
        damageDescription: '鼻頭裂傷',
        estimatedCompletionDate: '2026-05-10',
        intakeDate: '2026-04-29',
        paperOrderNo: 'BR-2026-0001',
        paymentReceived: true,
      },
    });
  });

  it('builds a single INITIAL quote item and trims OTHER color values', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    formState.paperOrderNo = 'BR-2026-0002';
    formState.customerPhone = '0912345678';
    formState.customerModeDecision = 'reuse';
    formState.selectedCustomerId = '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2';
    formState.boardType = 'SNOWBOARD';
    formState.boardColorChoice = 'OTHER';
    formState.boardColorOther = ' 藍白漸層 ';
    formState.damageDescription = '表面刮傷';
    formState.initialQuoteAmount = '500';
    formState.initialQuoteDescription = ' ';

    const result = buildAdminWorkOrderCreatePayload(formState);

    expect(result.fieldErrors).toEqual({});
    expect(result.payload).toEqual({
      board: {
        boardType: 'SNOWBOARD',
        color: '藍白漸層',
      },
      customerId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      customerMode: 'reuse',
      quoteItems: [
        {
          amount: 500,
          description: '初始報價',
          itemType: 'INITIAL',
        },
      ],
      workOrder: {
        damageDescription: '表面刮傷',
        estimatedCompletionDate: '2026-05-10',
        intakeDate: '2026-04-29',
        paperOrderNo: 'BR-2026-0002',
        paymentReceived: false,
      },
    });

    formState.boardColorOther = '   ';
    const blankOtherColor = buildAdminWorkOrderCreatePayload(formState);

    expect(blankOtherColor.payload?.board.color).toBeUndefined();
  });

  it('requires boardLengthClass for surfboards and rejects it for non-surfboards', () => {
    const surfboardForm = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    surfboardForm.paperOrderNo = 'BR-2026-0003';
    surfboardForm.customerPhone = '0912345678';
    surfboardForm.customerModeDecision = 'create';
    surfboardForm.customerName = '王小明';
    surfboardForm.boardType = 'SURFBOARD';
    surfboardForm.damageDescription = '尾端裂傷';

    expect(buildAdminWorkOrderCreatePayload(surfboardForm).fieldErrors).toMatchObject({
      boardLengthClass: ['請選擇衝浪板長度分類。'],
    });

    const snowboardForm = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    snowboardForm.paperOrderNo = 'BR-2026-0004';
    snowboardForm.customerPhone = '0912345678';
    snowboardForm.customerModeDecision = 'create';
    snowboardForm.customerName = '王小明';
    snowboardForm.boardType = 'SNOWBOARD';
    snowboardForm.boardLengthClass = 'LONGBOARD';
    snowboardForm.damageDescription = '表面刮傷';

    expect(buildAdminWorkOrderCreatePayload(snowboardForm).fieldErrors).toMatchObject({
      boardLengthClass: ['只有衝浪板可以設定長度分類。'],
    });
  });

  it('adds a high-contrast outline to the selected board color button', () => {
    const selectedClassName = getAdminWorkOrderCreateBoardColorButtonClassName(
      'border-sky-300 bg-sky-500 text-white',
      true,
    );
    const unselectedClassName = getAdminWorkOrderCreateBoardColorButtonClassName(
      'border-sky-300 bg-sky-500 text-white',
      false,
    );

    expect(selectedClassName).toContain('ring-slate-950');
    expect(selectedClassName).toContain('ring-offset-2');
    expect(selectedClassName).toContain('shadow-[inset_0_0_0_2px_rgba(255,255,255,0.92)]');
    expect(unselectedClassName).not.toContain('ring-slate-950');
  });

  it('detects lookup reset need and unsaved draft changes explicitly', () => {
    expect(shouldResetCustomerLookupResolution('0912345678', '0912-345-678')).toBe(false);
    expect(shouldResetCustomerLookupResolution('0912345678', '0912345679')).toBe(true);
    expect(shouldResetCustomerLookupResolution('0912345678', '0912')).toBe(true);
    expect(shouldAutoLookupCustomerPhone(null, '0912345678')).toBe(true);
    expect(shouldAutoLookupCustomerPhone('0912345678', '0912345678')).toBe(false);
    expect(shouldAutoLookupCustomerPhone('0912345678', '0912345679')).toBe(true);
    expect(shouldAutoLookupCustomerPhone(null, '0912')).toBe(false);

    expect(resolveAdminCustomerLookupCandidates([])).toEqual({
      customerModeDecision: 'create',
      selectedCustomerId: '',
    });
    expect(
      resolveAdminCustomerLookupCandidates([
        {
          createdAt: '2026-05-22T09:30:00.000Z',
          id: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
          name: '王小明',
          phone: '0912345678',
        },
      ]),
    ).toEqual({
      customerModeDecision: 'reuse',
      selectedCustomerId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
    });
    expect(
      resolveAdminCustomerLookupCandidates([
        {
          createdAt: '2026-05-22T09:30:00.000Z',
          id: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
          name: '王小明',
          phone: '0912345678',
        },
        {
          createdAt: '2026-05-22T09:31:00.000Z',
          id: '0cfaf6b0-02a6-47cf-a9a6-42f460ef8465',
          name: '王小美',
          phone: '0912345678',
        },
      ]),
    ).toEqual({
      customerModeDecision: 'unresolved',
      selectedCustomerId: '',
    });

    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');
    const baseline = normalizeAdminWorkOrderCreateFormState(formState);

    formState.customerName = '  ';
    expect(
      hasAdminWorkOrderCreateUnsavedChanges(
        baseline,
        normalizeAdminWorkOrderCreateFormState(formState),
      ),
    ).toBe(false);

    formState.paperOrderNo = 'BR-2026-9999';
    expect(
      hasAdminWorkOrderCreateUnsavedChanges(
        baseline,
        normalizeAdminWorkOrderCreateFormState(formState),
      ),
    ).toBe(true);
  });
});
