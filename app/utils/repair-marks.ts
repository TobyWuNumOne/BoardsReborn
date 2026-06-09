import type { Database } from '../../types/database.types';

export type RepairCountSource = Database['public']['Enums']['repair_count_source'];
export type RepairMarkBoardSide = Database['public']['Enums']['repair_mark_board_side'];
export type RepairMarkBoardType = Database['public']['Enums']['board_type'];

export interface RepairMark {
  boardSide: RepairMarkBoardSide;
  heightRatio: number;
  id: string;
  sortOrder: number;
  templateKey: string;
  widthRatio: number;
  xRatio: number;
  yRatio: number;
}

export interface RepairMarkDraft extends RepairMark {
  isSelected?: boolean;
}

export interface RepairMarksSummary {
  backCount: number;
  frontCount: number;
  totalCount: number;
}

export const DEFAULT_ACTIVE_REPAIR_MARK_BOARD_SIDE: RepairMarkBoardSide = 'front';
export const REPAIR_MARK_DEFAULT_SIZE_RATIO = 0.18;
export const REPAIR_MARK_DEFAULT_DIAMETER_PX = 60;
export const REPAIR_MARK_MIN_SIZE_RATIO = 0.06;
export const REPAIR_MARK_MAX_SIZE_RATIO = 0.55;
export const REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX = 1024;

const BOARD_SIDE_LABELS: Record<RepairMarkBoardType, Record<RepairMarkBoardSide, string>> = {
  SNOWBOARD: {
    back: '底面',
    front: '上表面',
  },
  SUP: {
    back: '背面',
    front: '正面',
  },
  SURFBOARD: {
    back: '背面',
    front: '正面',
  },
};

export const getRepairMarkSurfaceLabel = (
  boardType: RepairMarkBoardType | null | undefined,
  boardSide: RepairMarkBoardSide,
) => {
  if (!boardType) {
    return boardSide === 'front' ? '正面' : '背面';
  }

  return BOARD_SIDE_LABELS[boardType][boardSide];
};

export const shouldUseSingleSurfaceRepairMarksLayout = (viewportWidth: number) =>
  viewportWidth <= REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX;

export const getVisibleRepairMarkBoardSides = (
  activeBoardSide: RepairMarkBoardSide,
  isSingleSurfaceLayout: boolean,
): RepairMarkBoardSide[] => (isSingleSurfaceLayout ? [activeBoardSide] : ['front', 'back']);

export const getRepairMarkTemplateKey = (
  boardType: RepairMarkBoardType,
  boardSide: RepairMarkBoardSide,
) => `${boardType}:${boardSide}:v1`;

export const clampRepairMarkSizeRatio = (value: number) =>
  Math.min(REPAIR_MARK_MAX_SIZE_RATIO, Math.max(REPAIR_MARK_MIN_SIZE_RATIO, value));

export const clampRepairMarkCenterRatio = (value: number) => Math.min(1, Math.max(0, value));

export const normalizeRepairMark = (
  mark: Omit<RepairMark, 'heightRatio' | 'sortOrder' | 'widthRatio' | 'xRatio' | 'yRatio'> & {
    heightRatio: number;
    sortOrder: number;
    widthRatio: number;
    xRatio: number;
    yRatio: number;
  },
): RepairMark => ({
  ...mark,
  heightRatio: clampRepairMarkSizeRatio(mark.heightRatio),
  sortOrder: Math.max(0, mark.sortOrder),
  widthRatio: clampRepairMarkSizeRatio(mark.widthRatio),
  xRatio: clampRepairMarkCenterRatio(mark.xRatio),
  yRatio: clampRepairMarkCenterRatio(mark.yRatio),
});

export const reindexRepairMarks = (marks: RepairMark[]): RepairMark[] =>
  marks
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((mark, index) => ({
      ...mark,
      sortOrder: index,
    }));

export const cloneRepairMarks = (marks: RepairMark[]): RepairMark[] =>
  marks.map((mark) => ({ ...mark }));

export const summarizeRepairMarks = (marks: RepairMark[]): RepairMarksSummary =>
  marks.reduce<RepairMarksSummary>(
    (summary, mark) => {
      if (mark.boardSide === 'front') {
        summary.frontCount += 1;
      } else {
        summary.backCount += 1;
      }

      summary.totalCount += 1;
      return summary;
    },
    {
      backCount: 0,
      frontCount: 0,
      totalCount: 0,
    },
  );

export const deriveRepairCount = (marks: RepairMark[]) => {
  const count = marks.length;
  return count > 0 ? count : null;
};

export const createRepairMarkId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `repair-mark-${Math.random().toString(36).slice(2, 10)}`;

export const createRepairMarkAtPoint = (
  boardType: RepairMarkBoardType,
  boardSide: RepairMarkBoardSide,
  xRatio: number,
  yRatio: number,
  sortOrder: number,
  canvasSize?: {
    height: number;
    width: number;
  },
): RepairMark => ({
  boardSide,
  heightRatio: clampRepairMarkSizeRatio(
    canvasSize ? REPAIR_MARK_DEFAULT_DIAMETER_PX / canvasSize.height : REPAIR_MARK_DEFAULT_SIZE_RATIO,
  ),
  id: createRepairMarkId(),
  sortOrder,
  templateKey: getRepairMarkTemplateKey(boardType, boardSide),
  widthRatio: clampRepairMarkSizeRatio(
    canvasSize ? REPAIR_MARK_DEFAULT_DIAMETER_PX / canvasSize.width : REPAIR_MARK_DEFAULT_SIZE_RATIO,
  ),
  xRatio: clampRepairMarkCenterRatio(xRatio),
  yRatio: clampRepairMarkCenterRatio(yRatio),
});

export const adjustRepairMarkSize = (mark: RepairMark, delta: number): RepairMark => ({
  ...mark,
  heightRatio: clampRepairMarkSizeRatio(mark.heightRatio * (1 + delta)),
  widthRatio: clampRepairMarkSizeRatio(mark.widthRatio * (1 + delta)),
});
