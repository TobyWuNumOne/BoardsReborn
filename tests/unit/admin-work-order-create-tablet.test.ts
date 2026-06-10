import { describe, expect, it } from 'vitest';
import {
  adjustBoardSizeLabel,
  adjustInitialQuoteAmount,
  adjustRepairSpotCount,
  appendDelimitedText,
  appendLineText,
  BOARD_SIZE_QUICK_OPTIONS,
  formatBoardSizeInches,
  getBoardSizeQuickOptions,
  getEstimatedCompletionDateQuickValue,
  getRepairSpotCount,
  getRequiredFieldSummary,
  parseBoardSizeInches,
  sanitizeNumericInput,
  setRepairSpotCount,
} from '../../app/utils/admin-work-order-create-tablet';
import { createAdminWorkOrderCreateInitialFormState } from '../../app/utils/admin-work-order-create';

describe('admin work-order create tablet helpers', () => {
  it('exposes board size quick options by surfboard length class', () => {
    expect(getBoardSizeQuickOptions('SHORTBOARD')).toEqual(BOARD_SIZE_QUICK_OPTIONS.SHORTBOARD);
    expect(getBoardSizeQuickOptions('MID_LENGTH')).toContain("7'0");
    expect(getBoardSizeQuickOptions('LONGBOARD')).toContain("9'6");
    expect(getBoardSizeQuickOptions('')).toEqual([]);
  });

  it('parses, formats, and adjusts feet/inch board size labels', () => {
    expect(parseBoardSizeInches("6'0")).toBe(72);
    expect(parseBoardSizeInches("5'11")).toBe(71);
    expect(parseBoardSizeInches('bad')).toBeNull();
    expect(parseBoardSizeInches("6'12")).toBeNull();

    expect(formatBoardSizeInches(72)).toBe("6'0");
    expect(adjustBoardSizeLabel("6'0", 1)).toBe("6'1");
    expect(adjustBoardSizeLabel("6'0", -1)).toBe("5'11");
    expect(adjustBoardSizeLabel("5'11", 1)).toBe("6'0");
    expect(adjustBoardSizeLabel("7'0", -1)).toBe("6'11");
    expect(adjustBoardSizeLabel('', 1)).toBeNull();
  });

  it('calculates estimated completion quick dates from the local date string', () => {
    expect(getEstimatedCompletionDateQuickValue('2026-05-11', 0)).toBe('2026-05-11');
    expect(getEstimatedCompletionDateQuickValue('2026-05-11', 3)).toBe('2026-05-14');
    expect(getEstimatedCompletionDateQuickValue('2026-05-30', 5)).toBe('2026-06-04');
    expect(getEstimatedCompletionDateQuickValue('not-a-date', 5)).toBe('');
  });

  it('sanitizes and adjusts initial quote amounts without producing zero payload values', () => {
    expect(sanitizeNumericInput('NT$ 1,200')).toBe('1200');
    expect(adjustInitialQuoteAmount('', 100)).toBe('100');
    expect(adjustInitialQuoteAmount('500', 1000)).toBe('1500');
    expect(adjustInitialQuoteAmount('500', -1000)).toBe('');
    expect(adjustInitialQuoteAmount('10', -10)).toBe('');
  });

  it('appends quick chip text without duplicates', () => {
    expect(appendDelimitedText('', '鼻頭傷')).toBe('鼻頭傷');
    expect(appendDelimitedText('鼻頭傷', '尾部傷')).toBe('鼻頭傷、尾部傷');
    expect(appendDelimitedText('鼻頭傷、尾部傷', '鼻頭傷')).toBe('鼻頭傷、尾部傷');

    expect(appendLineText('', '需拍照')).toBe('需拍照');
    expect(appendLineText('需拍照', '客人急件')).toBe('需拍照\n客人急件');
    expect(appendLineText('需拍照\n客人急件', '需拍照')).toBe('需拍照\n客人急件');
  });

  it('sets and adjusts repair spot count in the damage description text', () => {
    expect(setRepairSpotCount('', 3)).toBe('維修處數量：3處');
    expect(setRepairSpotCount('鼻頭傷', 2)).toBe('鼻頭傷、維修處數量：2處');
    expect(setRepairSpotCount('鼻頭傷、維修處數量：2處', 4)).toBe('鼻頭傷、維修處數量：4處');
    expect(setRepairSpotCount('鼻頭傷、維修處數量：4處', 'many')).toBe('鼻頭傷、維修處數量：多處');
    expect(getRepairSpotCount('鼻頭傷、維修處數量：多處')).toBe('many');
    expect(adjustRepairSpotCount('鼻頭傷、維修處數量：2處', 1)).toBe('鼻頭傷、維修處數量：3處');
    expect(adjustRepairSpotCount('鼻頭傷、維修處數量：1處', -1)).toBe('鼻頭傷、維修處數量：1處');
    expect(adjustRepairSpotCount('', 1)).toBe('維修處數量：1處');
  });

  it('builds a required-field completion summary from existing form rules', () => {
    const formState = createAdminWorkOrderCreateInitialFormState('2026-05-11');
    let summary = getRequiredFieldSummary(formState);

    expect(summary.total).toBe(9);
    expect(summary.missingLabels).toContain('工單號碼');
    expect(summary.missingLabels).toContain('顧客查詢');
    expect(summary.missingLabels).toContain('維修處數');

    formState.paperOrderNo = '1001';
    formState.customerPhone = '0912345678';
    formState.customerModeDecision = 'create';
    formState.customerName = '王小明';
    formState.boardType = 'SURFBOARD';
    formState.boardLengthClass = 'SHORTBOARD';
    formState.damageDescription = '鼻頭傷';
    formState.repairCount = '2';
    formState.repairCountSource = 'manual';

    summary = getRequiredFieldSummary(formState);

    expect(summary).toEqual({
      completed: 10,
      missingLabels: [],
      total: 10,
    });
  });
});
