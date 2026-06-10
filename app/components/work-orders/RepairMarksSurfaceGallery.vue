<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { cn } from '@/lib/utils';
import type { RepairMark, RepairMarkBoardSide, RepairMarkBoardType } from '~/utils/repair-marks';
import {
  DEFAULT_ACTIVE_REPAIR_MARK_BOARD_SIDE,
  getRepairMarkSurfaceLabel,
  getVisibleRepairMarkBoardSides,
  REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX,
} from '~/utils/repair-marks';
import RepairMarksBoardCanvas from '~/components/work-orders/RepairMarksBoardCanvas.vue';

const props = withDefaults(
  defineProps<{
    boardType: RepairMarkBoardType;
    canvasHeight?: number;
    canvasWidth?: number;
    dualSurfaceMinHeightClass?: string;
    editable?: boolean;
    marks: RepairMark[];
    selectedMarkId?: string | null;
    singleSurfaceCanvasWrapperClass?: string;
    singleSurfaceGalleryClass?: string;
    singleSurfaceMinHeightClass?: string;
    surfaceGapClass?: string;
  }>(),
  {
    canvasHeight: 860,
    canvasWidth: 540,
    dualSurfaceMinHeightClass: 'min-h-[32rem] xl:min-h-[44rem]',
    editable: false,
    selectedMarkId: null,
    singleSurfaceCanvasWrapperClass: '',
    singleSurfaceGalleryClass: '',
    singleSurfaceMinHeightClass: 'min-h-[44rem] xl:min-h-[52rem]',
    surfaceGapClass: 'gap-4',
  },
);

const emit = defineEmits<{
  (event: 'update:marks', value: RepairMark[]): void;
  (event: 'update:selectedMarkId', value: string | null): void;
}>();

const isSingleSurfaceLayout = useMediaQuery(
  `(max-width: ${REPAIR_MARK_SINGLE_SURFACE_BREAKPOINT_PX}px)`,
);
const activeBoardSide = ref<RepairMarkBoardSide>(DEFAULT_ACTIVE_REPAIR_MARK_BOARD_SIDE);

const surfaceOptions = computed(() => [
  {
    label: getRepairMarkSurfaceLabel(props.boardType, 'front'),
    value: 'front' as const,
  },
  {
    label: getRepairMarkSurfaceLabel(props.boardType, 'back'),
    value: 'back' as const,
  },
]);

const visibleBoardSides = computed(() =>
  getVisibleRepairMarkBoardSides(activeBoardSide.value, isSingleSurfaceLayout.value),
);
</script>

<template>
  <div :class="cn('flex h-full min-h-0 flex-col gap-3', isSingleSurfaceLayout && singleSurfaceGalleryClass)">
    <div v-if="isSingleSurfaceLayout" class="flex shrink-0 items-center justify-between gap-3">
      <p class="text-sm font-medium text-foreground">板面切換</p>
      <div class="inline-flex rounded-lg border bg-muted/20 p-1">
        <Button
          v-for="option in surfaceOptions"
          :key="option.value"
          type="button"
          :variant="activeBoardSide === option.value ? 'default' : 'ghost'"
          class="min-w-20"
          size="sm"
          @click="activeBoardSide = option.value"
        >
          {{ option.label }}
        </Button>
      </div>
    </div>

    <div
      :class="
        cn(
          'grid min-h-0 flex-1 items-stretch',
          surfaceGapClass,
          isSingleSurfaceLayout ? 'grid-cols-1' : 'grid-cols-2',
        )
      "
    >
      <div
        v-for="boardSide in visibleBoardSides"
        :key="boardSide"
        :class="
          cn(
            'flex min-h-0 h-full',
            isSingleSurfaceLayout ? singleSurfaceMinHeightClass : dualSurfaceMinHeightClass,
            isSingleSurfaceLayout && singleSurfaceCanvasWrapperClass,
          )
        "
      >
        <RepairMarksBoardCanvas
          :board-side="boardSide"
          :board-type="boardType"
          :editable="editable"
          :height="canvasHeight"
          :marks="marks"
          :selected-mark-id="selectedMarkId"
          :width="canvasWidth"
          @update:marks="emit('update:marks', $event)"
          @update:selected-mark-id="emit('update:selectedMarkId', $event)"
        />
      </div>
    </div>
  </div>
</template>
