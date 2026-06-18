import { describe, expect, it } from 'vitest';
import {
  buildAdminWorkOrderCreatePayload,
  createAdminWorkOrderCreateInitialFormState,
  getFixedNextSundayDateString,
  getAdminWorkOrderCreateBoardColorButtonClassName,
  hasAdminWorkOrderCreateUnsavedChanges,
  normalizeAdminWorkOrderCreateMode,
  normalizeAdminWorkOrderCreateFormState,
  resolveAdminCustomerLookupCandidates,
  shouldAutoLookupCustomerPhone,
  shouldResetCustomerLookupResolution,
} from '../../app/utils/admin-work-order-create';

describe('admin work-order create helpers', () => {
  it('enables test mode only for the explicit test query value', () => {
    expect(normalizeAdminWorkOrderCreateMode({})).toBe('standard');
    expect(normalizeAdminWorkOrderCreateMode({ mode: 'test' })).toBe('test');
    expect(normalizeAdminWorkOrderCreateMode({ mode: 'standard' })).toBe('standard');
    expect(normalizeAdminWorkOrderCreateMode({ mode: ['test'] })).toBe('standard');
  });

  it('defaults estimated completion date from intake date to the following Sunday cycle', () => {
    expect(getFixedNextSundayDateString('2026-04-27')).toBe('2026-05-10');
    expect(getFixedNextSundayDateString('2026-05-03')).toBe('2026-05-10');

    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    expect(formState.intakeDate).toBe('2026-04-29');
    expect(formState.estimatedCompletionDate).toBe('2026-05-10');
  });

  it('builds create payload for new customers and omits quote items when initial quote is blank', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    formState.customerPhone = '0912-345-678';
    formState.customerModeDecision = 'create';
    formState.customerName = '王小明';
    formState.boardType = 'SURFBOARD';
    formState.boardLengthClass = 'SHORTBOARD';
    formState.boardBrand = 'Channel Islands';
    formState.paymentReceived = true;
    formState.repairCount = '1';
    formState.repairCountSource = 'manual';

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
        estimatedCompletionDate: '2026-05-10',
        intakeDate: '2026-04-29',
        paymentReceived: true,
        repairCount: 1,
        repairCountSource: 'manual',
      },
    });
  });

  it('includes an editable 99 number only for test-mode create payloads', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    Object.assign(formState, { paperOrderNo: '990001' });
    formState.customerPhone = '0912345678';
    formState.customerModeDecision = 'create';
    formState.customerName = '王小明';
    formState.boardType = 'SUP';
    formState.repairCount = '1';
    formState.repairCountSource = 'manual';

    const result = buildAdminWorkOrderCreatePayload(formState, 'test');

    expect(result.fieldErrors).toEqual({});
    expect(result.payload).toMatchObject({
      paperOrderMode: 'test',
      workOrder: {
        paperOrderNo: '990001',
      },
    });

    Object.assign(formState, { paperOrderNo: '260001' });
    expect(buildAdminWorkOrderCreatePayload(formState, 'test').fieldErrors).toMatchObject({
      paperOrderNo: ['測試工單號必須為 99 開頭，且至少包含四位流水號。'],
    });
  });

  it('builds a single INITIAL quote item and trims OTHER color values', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    formState.customerPhone = '0912345678';
    formState.customerModeDecision = 'reuse';
    formState.selectedCustomerId = '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2';
    formState.boardType = 'SNOWBOARD';
    formState.boardColorChoice = 'MULTICOLOR';
    formState.repairMarks = [
      {
        boardSide: 'front',
        heightRatio: 0.18,
        id: 'mark-1',
        sortOrder: 0,
        templateKey: 'SNOWBOARD:front:v1',
        widthRatio: 0.18,
        xRatio: 0.4,
        yRatio: 0.3,
      },
    ];

    const presetColorResult = buildAdminWorkOrderCreatePayload(formState);

    expect(presetColorResult.fieldErrors).toEqual({});
    expect(presetColorResult.payload?.board.color).toBe('MULTICOLOR');
    expect(presetColorResult.payload?.workOrder.repairCount).toBe(1);
    expect(presetColorResult.payload?.workOrder.repairCountSource).toBe('auto');

    formState.boardColorChoice = 'OTHER';
    formState.boardColorOther = ' 藍白漸層 ';
    formState.initialQuoteAmount = '500';
    formState.initialQuoteDescription = ' ';
    formState.repairCount = '';
    formState.repairCountSource = 'auto';

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
      repairMarks: [
        {
          boardSide: 'front',
          heightRatio: 0.18,
          id: 'mark-1',
          sortOrder: 0,
          templateKey: 'SNOWBOARD:front:v1',
          widthRatio: 0.18,
          xRatio: 0.4,
          yRatio: 0.3,
        },
      ],
      workOrder: {
        estimatedCompletionDate: '2026-05-10',
        intakeDate: '2026-04-29',
        paymentReceived: false,
        repairCount: 1,
        repairCountSource: 'auto',
      },
    });

    formState.boardColorOther = '   ';
    const blankOtherColor = buildAdminWorkOrderCreatePayload(formState);

    expect(blankOtherColor.payload?.board.color).toBeUndefined();
  });

  it('requires boardLengthClass for surfboards and rejects it for non-surfboards', () => {
    const surfboardForm = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    surfboardForm.customerPhone = '0912345678';
    surfboardForm.customerModeDecision = 'create';
    surfboardForm.customerName = '王小明';
    surfboardForm.boardType = 'SURFBOARD';

    expect(buildAdminWorkOrderCreatePayload(surfboardForm).fieldErrors).toMatchObject({
      boardLengthClass: ['請選擇衝浪板長度分類。'],
    });

    const snowboardForm = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    snowboardForm.customerPhone = '0912345678';
    snowboardForm.customerModeDecision = 'create';
    snowboardForm.customerName = '王小明';
    snowboardForm.boardType = 'SNOWBOARD';
    snowboardForm.boardLengthClass = 'LONGBOARD';

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

  it('requires repair count before building the create payload', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-04-29');

    formState.customerPhone = '0912345678';
    formState.customerModeDecision = 'create';
    formState.customerName = '王小明';
    formState.boardType = 'SNOWBOARD';
    formState.damageDescription = '表面刮傷';

    expect(buildAdminWorkOrderCreatePayload(formState).fieldErrors).toMatchObject({
      repairCount: ['請先標記受損位置，或改用手動輸入維修處數。'],
    });
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

    formState.customerPhone = '0912345678';
    expect(
      hasAdminWorkOrderCreateUnsavedChanges(
        baseline,
        normalizeAdminWorkOrderCreateFormState(formState),
      ),
    ).toBe(true);
  });
});
