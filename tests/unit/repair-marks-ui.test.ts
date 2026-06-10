import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_REPAIR_MARK_BOARD_SIDE,
  getVisibleRepairMarkBoardSides,
  REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX,
  REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX,
  shouldUseThreeColumnRepairMarksEditorLayout,
  shouldUseSingleSurfaceRepairMarksLayout,
} from '../../app/utils/repair-marks';

describe('repair marks responsive UI helpers', () => {
  it('switches to single-surface layout at and below the shared breakpoint', () => {
    expect(shouldUseSingleSurfaceRepairMarksLayout(REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX + 1)).toBe(false);
    expect(shouldUseSingleSurfaceRepairMarksLayout(REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX)).toBe(true);
    expect(shouldUseSingleSurfaceRepairMarksLayout(768)).toBe(true);
  });

  it('returns visible surfaces from the shared single or dual-surface rule', () => {
    expect(
      getVisibleRepairMarkBoardSides(DEFAULT_ACTIVE_REPAIR_MARK_BOARD_SIDE, true),
    ).toEqual(['front']);
    expect(getVisibleRepairMarkBoardSides('back', true)).toEqual(['back']);
    expect(getVisibleRepairMarkBoardSides('front', false)).toEqual(['front', 'back']);
  });

  it('keeps the editor in three-column mode from the 11-inch ipad breakpoint upward', () => {
    expect(shouldUseThreeColumnRepairMarksEditorLayout(1180)).toBe(true);
    expect(
      shouldUseThreeColumnRepairMarksEditorLayout(
        REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX,
      ),
    ).toBe(true);
    expect(
      shouldUseThreeColumnRepairMarksEditorLayout(
        REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX - 1,
      ),
    ).toBe(false);
  });
});
