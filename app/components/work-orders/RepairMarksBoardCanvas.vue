<script setup lang="ts">
import type Konva from 'konva';
import type { RepairMark, RepairMarkBoardSide, RepairMarkBoardType } from '~/utils/repair-marks';
import {
  clampRepairMarkCenterRatio,
  clampRepairMarkSizeRatio,
  createRepairMarkAtPoint,
} from '~/utils/repair-marks';

const props = withDefaults(
  defineProps<{
    boardSide: RepairMarkBoardSide;
    boardType: RepairMarkBoardType;
    editable?: boolean;
    height?: number;
    marks: RepairMark[];
    selectedMarkId?: string | null;
    width?: number;
  }>(),
  {
    editable: false,
    height: 480,
    selectedMarkId: null,
    width: 280,
  },
);

const emit = defineEmits<{
  (event: 'update:marks', value: RepairMark[]): void;
  (event: 'update:selectedMarkId', value: string | null): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const stageRef = ref<{ getNode: () => Konva.Stage } | null>(null);
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null);
const containerSize = ref({
  height: 0,
  width: 0,
});
let resizeObserver: ResizeObserver | null = null;
let resizeFrame: number | null = null;

const surfaceMarks = computed(() =>
  props.marks
    .filter((mark) => mark.boardSide === props.boardSide)
    .sort((left, right) => left.sortOrder - right.sortOrder),
);

const updateMarks = (updater: (marks: RepairMark[]) => RepairMark[]) => {
  emit('update:marks', updater(props.marks.map((mark) => ({ ...mark }))));
};

const attachTransformer = async () => {
  if (!props.editable || !transformerRef.value) {
    return;
  }

  await nextTick();

  const transformerNode = transformerRef.value.getNode();
  const stage = transformerNode.getStage();
  const selectedMarkId = props.selectedMarkId;

  if (!stage || !selectedMarkId) {
    transformerNode.nodes([]);
    return;
  }

  const selectedNode = stage.findOne(`.${selectedMarkId}`);
  transformerNode.nodes(selectedNode ? [selectedNode] : []);
  transformerNode.getLayer()?.batchDraw();
};

const aspectRatio = computed(() => props.width / props.height);
const stageSize = computed(() => {
  const fallback = {
    height: props.height,
    width: props.width,
  };

  if (!containerSize.value.width || !containerSize.value.height) {
    return fallback;
  }

  const widthFromHeight = containerSize.value.height * aspectRatio.value;
  const nextWidth = Math.min(containerSize.value.width, widthFromHeight);
  const nextHeight = nextWidth / aspectRatio.value;

  return {
    height: nextHeight,
    width: nextWidth,
  };
});

const syncContainerSize = () => {
  const element = containerRef.value;

  if (!element) {
    return;
  }

  const { height, width } = element.getBoundingClientRect();

  containerSize.value = {
    height: Math.max(0, height),
    width: Math.max(0, width),
  };
};

const teardownResizeObserver = () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
};

const scheduleContainerSync = () => {
  if (typeof window === 'undefined') {
    syncContainerSize();
    return;
  }

  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    syncContainerSize();
  });
};

const setupResizeObserver = () => {
  const element = containerRef.value;

  teardownResizeObserver();

  if (!element) {
    return;
  }

  scheduleContainerSync();

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      scheduleContainerSync();
    });
    resizeObserver.observe(element);
  }
};

onMounted(() => {
  setupResizeObserver();
});

onBeforeUnmount(() => {
  teardownResizeObserver();

  if (resizeFrame !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
  }
});

watch(
  containerRef,
  () => {
    setupResizeObserver();
  },
  { flush: 'post' },
);

watch(
  () => [props.selectedMarkId, props.marks, props.editable, props.boardSide, stageSize.value.width, stageSize.value.height],
  () => {
    void attachTransformer();
  },
  { deep: true, immediate: true },
);

const toCanvasX = (xRatio: number) => xRatio * stageSize.value.width;
const toCanvasY = (yRatio: number) => yRatio * stageSize.value.height;
const toRadiusX = (widthRatio: number) => (widthRatio * stageSize.value.width) / 2;
const toRadiusY = (heightRatio: number) => (heightRatio * stageSize.value.height) / 2;
const getNextSortOrder = () =>
  props.marks.reduce((maxValue, mark) => Math.max(maxValue, mark.sortOrder), -1) + 1;

const boardGeometry = computed(() => {
  const width = stageSize.value.width;
  const height = stageSize.value.height;
  const centerX = width / 2;

  if (props.boardType === 'SNOWBOARD') {
    return {
      bottomY: height * 0.968,
      centerX,
      controlInset: width * 0.165,
      hipY: height * 0.79,
      isFlatTail: false,
      shoulderY: height * 0.2,
      tailCurveY: height * 0.9,
      tailFlatHalfWidth: 0,
      topY: height * 0.032,
      widestInset: width * 0.11,
    };
  }

  return {
    bottomY: height * 0.978,
    centerX,
    controlInset: width * 0.175,
    hipY: height * 0.805,
    isFlatTail: true,
    shoulderY: height * 0.17,
    tailCurveY: height * 0.93,
    tailFlatHalfWidth: width * 0.145,
    topY: height * 0.022,
    widestInset: width * 0.1,
  };
});

const boardPathData = computed(() => {
  const width = stageSize.value.width;
  const height = stageSize.value.height;
  const geometry = boardGeometry.value;

  if (props.boardType === 'SNOWBOARD') {
    const rightTipX = width * 0.83;
    const leftTipX = width * 0.17;
    const rightShoulderX = width * 0.81;
    const leftShoulderX = width * 0.19;
    const rightWaistX = width * 0.775;
    const leftWaistX = width * 0.225;
    const midY = height * 0.5;

    return [
      `M ${geometry.centerX} ${geometry.topY}`,
      `C ${width * 0.69} ${geometry.topY + height * 0.002}, ${rightTipX} ${height * 0.08}, ${rightShoulderX} ${geometry.shoulderY}`,
      `C ${rightShoulderX} ${height * 0.34}, ${rightWaistX} ${height * 0.43}, ${rightWaistX} ${midY}`,
      `C ${rightWaistX} ${height * 0.57}, ${rightShoulderX} ${height * 0.66}, ${rightShoulderX} ${geometry.hipY}`,
      `C ${rightTipX} ${height * 0.92}, ${width * 0.69} ${geometry.bottomY - height * 0.002}, ${geometry.centerX} ${geometry.bottomY}`,
      `C ${width * 0.31} ${geometry.bottomY - height * 0.002}, ${leftTipX} ${height * 0.92}, ${leftShoulderX} ${geometry.hipY}`,
      `C ${leftShoulderX} ${height * 0.66}, ${leftWaistX} ${height * 0.57}, ${leftWaistX} ${midY}`,
      `C ${leftWaistX} ${height * 0.43}, ${leftShoulderX} ${height * 0.34}, ${leftShoulderX} ${geometry.shoulderY}`,
      `C ${leftTipX} ${height * 0.08}, ${width * 0.31} ${geometry.topY + height * 0.002}, ${geometry.centerX} ${geometry.topY}`,
      'Z',
    ].join(' ');
  }

  if (!geometry.isFlatTail) {
    return [
      `M ${geometry.centerX} ${geometry.topY}`,
      `C ${width - geometry.controlInset} ${geometry.shoulderY * 0.34}, ${width - geometry.widestInset} ${geometry.shoulderY}, ${width - geometry.widestInset} ${height * 0.5}`,
      `C ${width - geometry.widestInset} ${geometry.hipY}, ${width - geometry.controlInset} ${geometry.tailCurveY}, ${geometry.centerX} ${geometry.bottomY}`,
      `C ${geometry.controlInset} ${geometry.tailCurveY}, ${geometry.widestInset} ${geometry.hipY}, ${geometry.widestInset} ${height * 0.5}`,
      `C ${geometry.widestInset} ${geometry.shoulderY}, ${geometry.controlInset} ${geometry.shoulderY * 0.34}, ${geometry.centerX} ${geometry.topY}`,
      'Z',
    ].join(' ');
  }

  const rightRailX = width - geometry.widestInset;
  const leftRailX = geometry.widestInset;
  const rightTailX = geometry.centerX + geometry.tailFlatHalfWidth;
  const leftTailX = geometry.centerX - geometry.tailFlatHalfWidth;

  return [
    `M ${geometry.centerX} ${geometry.topY}`,
    `C ${width - geometry.controlInset} ${geometry.topY + height * 0.006}, ${rightRailX} ${geometry.shoulderY * 0.78}, ${rightRailX} ${height * 0.5}`,
    `C ${rightRailX} ${geometry.hipY}, ${width - geometry.controlInset} ${geometry.tailCurveY}, ${rightTailX} ${geometry.bottomY}`,
    `L ${leftTailX} ${geometry.bottomY}`,
    `C ${geometry.controlInset} ${geometry.tailCurveY}, ${leftRailX} ${geometry.hipY}, ${leftRailX} ${height * 0.5}`,
    `C ${leftRailX} ${geometry.shoulderY * 0.78}, ${geometry.controlInset} ${geometry.topY + height * 0.006}, ${geometry.centerX} ${geometry.topY}`,
    'Z',
  ].join(' ');
});

const tailDotConfig = computed(() => ({
  fill: '#111111',
  listening: false,
  radius: Math.max(6, stageSize.value.width * 0.022),
  x: stageSize.value.width / 2,
  y: props.boardType === 'SNOWBOARD' ? stageSize.value.height * 0.935 : stageSize.value.height * 0.945,
}));

const finBoxConfigs = computed(() => {
  const baseY = props.boardType === 'SNOWBOARD' ? stageSize.value.height * 0.87 : stageSize.value.height * 0.855;
  const boxWidth = Math.max(8, stageSize.value.width * 0.022);
  const boxHeight = Math.max(28, stageSize.value.height * 0.06);

  return [
    {
      fill: '#111111',
      height: boxHeight * 0.78,
      listening: false,
      width: boxWidth,
      x: stageSize.value.width * 0.33,
      y: baseY,
    },
    {
      fill: '#111111',
      height: boxHeight * 1.08,
      listening: false,
      width: boxWidth * 1.05,
      x: stageSize.value.width * 0.5 - boxWidth / 2,
      y: baseY + boxHeight * 0.16,
    },
    {
      fill: '#111111',
      height: boxHeight * 0.78,
      listening: false,
      width: boxWidth,
      x: stageSize.value.width * 0.67 - boxWidth,
      y: baseY,
    },
  ];
});

const handleStagePointerDown = (event: { evt: PointerEvent; target: Konva.Node }) => {
  const stage = stageRef.value?.getNode();

  if (!stage) {
    return;
  }

  const target = event.target;
  const targetName = target.name();
  const clickedExistingMark = surfaceMarks.value.some((mark) => mark.id === targetName);
  const targetParent = target.getParent();
  const targetClassName = target.getClassName();
  const targetParentClassName = targetParent?.getClassName();

  if (
    targetClassName === 'Transformer' ||
    targetParentClassName === 'Transformer' ||
    targetName.includes('_anchor') ||
    targetName.includes('back')
  ) {
    return;
  }

  if (target === stage) {
    emit('update:selectedMarkId', null);

    if (!props.editable) {
      return;
    }

    const pointerPosition = stage.getPointerPosition();

    if (!pointerPosition) {
      return;
    }

    const nextMark = createRepairMarkAtPoint(
      props.boardType,
      props.boardSide,
      pointerPosition.x / stageSize.value.width,
      pointerPosition.y / stageSize.value.height,
      getNextSortOrder(),
      {
        height: stageSize.value.height,
        width: stageSize.value.width,
      },
    );

    updateMarks((marks) => [...marks, nextMark]);
    emit('update:selectedMarkId', nextMark.id);
    return;
  }

  if (clickedExistingMark) {
    emit('update:selectedMarkId', targetName || null);
  }
};

const updateMarkById = (markId: string, updater: (mark: RepairMark) => RepairMark) => {
  updateMarks((marks) =>
    marks.map((mark) => (mark.id === markId ? updater(mark) : mark)),
  );
};

const handleDragEnd = (markId: string, event: { target: Konva.Ellipse }) => {
  const node = event.target;

  updateMarkById(markId, (mark) => ({
    ...mark,
    xRatio: clampRepairMarkCenterRatio(node.x() / stageSize.value.width),
    yRatio: clampRepairMarkCenterRatio(node.y() / stageSize.value.height),
  }));
};

const handleTransformEnd = (markId: string, event: { target: Konva.Ellipse }) => {
  const node = event.target;
  const nextWidthRatio = clampRepairMarkSizeRatio((node.radiusX() * node.scaleX() * 2) / stageSize.value.width);
  const nextHeightRatio = clampRepairMarkSizeRatio((node.radiusY() * node.scaleY() * 2) / stageSize.value.height);

  node.scaleX(1);
  node.scaleY(1);

  updateMarkById(markId, (mark) => ({
    ...mark,
    heightRatio: nextHeightRatio,
    widthRatio: nextWidthRatio,
    xRatio: clampRepairMarkCenterRatio(node.x() / stageSize.value.width),
    yRatio: clampRepairMarkCenterRatio(node.y() / stageSize.value.height),
  }));
};

</script>

<template>
  <ClientOnly>
    <div ref="containerRef" class="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm">
      <v-stage
        ref="stageRef"
        :config="{ width: stageSize.width, height: stageSize.height }"
        class="shrink-0 touch-none rounded-xl bg-white"
        @mousedown="handleStagePointerDown"
        @touchstart="handleStagePointerDown"
      >
        <v-layer>
          <v-path
            :config="{
              data: boardPathData,
              fill: '#ffffff',
              listening: false,
              shadowBlur: 0,
              stroke: '#111111',
              strokeWidth: 6,
            }"
          />

          <v-circle v-if="boardSide === 'front' && boardType !== 'SNOWBOARD'" :config="tailDotConfig" />
          <v-rect
            v-for="(finBox, finBoxIndex) in boardSide === 'back' && boardType !== 'SNOWBOARD' ? finBoxConfigs : []"
            :key="`fin-${finBoxIndex}`"
            :config="finBox"
          />

          <template v-for="(mark, index) in surfaceMarks" :key="mark.id">
            <v-ellipse
              :config="{
                x: toCanvasX(mark.xRatio),
                y: toCanvasY(mark.yRatio),
                radiusX: toRadiusX(mark.widthRatio),
                radiusY: toRadiusY(mark.heightRatio),
                stroke: mark.id === selectedMarkId ? '#dc2626' : '#f97316',
                strokeWidth: mark.id === selectedMarkId ? 3 : 2,
                dash: [8, 4],
                draggable: editable,
                name: mark.id,
              }"
              @dragend="handleDragEnd(mark.id, $event)"
              @transformend="handleTransformEnd(mark.id, $event)"
            />
            <v-rect
              :config="{
                x: toCanvasX(mark.xRatio) - 12,
                y: toCanvasY(mark.yRatio) - 13,
                width: 24,
                height: 24,
                cornerRadius: 999,
                fill: '#ffffff',
                opacity: 0.94,
                listening: false,
                stroke: '#ffffff',
                strokeWidth: 1,
              }"
            />
            <v-text
              :config="{
                x: toCanvasX(mark.xRatio) - 10,
                y: toCanvasY(mark.yRatio) - 10,
                width: 20,
                align: 'center',
                listening: false,
                text: String(index + 1),
                fontSize: 14,
                fontStyle: 'bold',
                fill: '#b91c1c',
              }"
            />
          </template>
          <v-transformer
            v-if="editable"
            ref="transformerRef"
            :config="{
              rotateEnabled: false,
              flipEnabled: false,
              ignoreStroke: true,
              anchorSize: 16,
              anchorStroke: '#dc2626',
              anchorFill: '#ffffff',
              borderStroke: '#dc2626',
              borderDash: [4, 4],
              boundBoxFunc: (
                _oldBox: { height: number; width: number; x: number; y: number },
                newBox: { height: number; width: number; x: number; y: number },
              ) => newBox,
            }"
          />
        </v-layer>
      </v-stage>
    </div>
  </ClientOnly>
</template>
