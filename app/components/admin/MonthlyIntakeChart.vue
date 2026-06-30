<script setup lang="ts">
import type { AdminDashboardMonthlyIntakePoint } from '~/utils/admin-dashboard';

const props = defineProps<{
  points: AdminDashboardMonthlyIntakePoint[];
}>();

const chartWidth = 640;
const chartHeight = 240;
const padding = {
  bottom: 34,
  left: 36,
  right: 20,
  top: 18,
};

const plotWidth = chartWidth - padding.left - padding.right;
const plotHeight = chartHeight - padding.top - padding.bottom;

const maxCount = computed(() => Math.max(1, ...props.points.map((point) => point.count)));
const chartPoints = computed(() =>
  props.points.map((point, index) => {
    const x =
      padding.left +
      (props.points.length <= 1 ? plotWidth / 2 : (plotWidth / (props.points.length - 1)) * index);
    const y = padding.top + plotHeight - (point.count / maxCount.value) * plotHeight;

    return {
      ...point,
      x,
      y,
    };
  }),
);
const linePoints = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.y}`).join(' '),
);
const gridLines = computed(() =>
  Array.from({ length: 4 }, (_, index) => {
    const y = padding.top + (plotHeight / 3) * index;
    const value = Math.round(maxCount.value - (maxCount.value / 3) * index);

    return { value, y };
  }),
);
</script>

<template>
  <div class="h-full min-h-72 w-full overflow-hidden rounded-lg border bg-card">
    <div
      v-if="points.length === 0"
      class="flex h-72 items-center justify-center px-4 text-sm text-muted-foreground"
    >
      尚無收件趨勢資料
    </div>

    <div v-else class="relative h-72 w-full">
      <div
        v-for="line in gridLines"
        :key="`html-label-${line.y}`"
        class="absolute left-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
        :style="{ top: `${(line.y / chartHeight) * 100}%` }"
      >
        {{ line.value }}
      </div>
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        class="h-60 w-full text-muted-foreground"
        role="img"
        aria-label="近 12 個月收件趨勢"
        preserveAspectRatio="none"
      >
        <line
          v-for="line in gridLines"
          :key="`grid-${line.y}`"
          :x1="padding.left"
          :x2="chartWidth - padding.right"
          :y1="line.y"
          :y2="line.y"
          class="stroke-border"
          stroke-dasharray="4 6"
          stroke-width="1"
        />
        <polyline
          :points="linePoints"
          fill="none"
          class="stroke-chart-2"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="3"
          vector-effect="non-scaling-stroke"
        />
        <circle
          v-for="point in chartPoints"
          :key="`dot-${point.month}`"
          :cx="point.x"
          :cy="point.y"
          r="4"
          class="fill-background stroke-chart-2"
          stroke-width="3"
          vector-effect="non-scaling-stroke"
        >
          <title>{{ point.label }}：{{ point.count }} 件</title>
        </circle>
      </svg>
      <div
        class="grid grid-cols-6 gap-1 px-8 pb-3 text-center text-[10px] text-muted-foreground md:grid-cols-12"
      >
        <span v-for="point in points" :key="`month-label-${point.month}`">
          {{ point.label.slice(5) }}
        </span>
      </div>
    </div>
  </div>
</template>
