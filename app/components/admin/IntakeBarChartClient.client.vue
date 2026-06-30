<script setup lang="ts">
import { VisAxis, VisGroupedBar, VisGroupedBarSelectors, VisXYContainer } from '@unovis/vue';
import type {
  AdminDashboardIntakePeriod,
  AdminDashboardMonthlyIntakePoint,
  AdminDashboardWeeklyIntakePoint,
} from '~/utils/admin-dashboard';
import { ChartContainer, ChartTooltip, type ChartConfig } from '~/components/ui/chart';
import { formatBoardCount, getAdminDashboardIntakePeriodLabel } from '~/utils/admin-dashboard';

type IntakePoint = AdminDashboardMonthlyIntakePoint | AdminDashboardWeeklyIntakePoint;

const props = defineProps<{
  period: AdminDashboardIntakePeriod;
  points: IntakePoint[];
}>();

interface IntakeChartDatum {
  count: number;
  index: number;
  label: string;
  tooltipLabel: string;
}

const chartConfig = {
  boards: {
    color: 'var(--chart-2)',
    label: '收件',
  },
} satisfies ChartConfig;

const chartData = computed<IntakeChartDatum[]>(() =>
  props.points.map((point, index) => ({
    count: point.count,
    index,
    label: point.label,
    tooltipLabel: 'startDate' in point ? `${point.startDate} - ${point.endDate}` : point.label,
  })),
);
const maxCount = computed(() => Math.max(1, ...chartData.value.map((point) => point.count)));
const yDomain = computed<[number, number]>(() => [0, maxCount.value]);
const xDomain = computed<[number, number]>(() => [
  -0.5,
  Math.max(0.5, chartData.value.length - 0.5),
]);

const escapeTooltipHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const tooltipTemplate = computed(() => {
  return (datum: IntakeChartDatum | undefined) => {
    if (!datum) {
      return undefined;
    }

    const label = escapeTooltipHtml(datum.tooltipLabel);
    const count = escapeTooltipHtml(formatBoardCount(datum.count));

    return `
      <div class="border-border/50 bg-background grid min-w-32 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
        <div class="font-medium">${label}</div>
        <div class="flex w-full items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-xs" style="background-color: ${chartConfig.boards.color};"></span>
          <span class="text-muted-foreground">收件</span>
          <span class="text-foreground ml-auto font-mono font-medium tabular-nums">${count}</span>
        </div>
      </div>
    `;
  };
});
</script>

<template>
  <div class="h-full min-h-72 w-full overflow-hidden rounded-lg border bg-card p-4">
    <div
      v-if="points.length === 0"
      class="flex h-64 items-center justify-center px-4 text-sm text-muted-foreground"
    >
      尚無{{ getAdminDashboardIntakePeriodLabel(period) }}收件資料
    </div>

    <ChartContainer v-else :config="chartConfig" class="h-64 w-full" :cursor="false">
      <VisXYContainer
        :data="chartData"
        :x-domain="xDomain"
        :y-domain="yDomain"
        :padding="{ left: 8, right: 8, top: 16, bottom: 0 }"
      >
        <VisGroupedBar
          :x="(datum: IntakeChartDatum) => datum.index"
          :y="(datum: IntakeChartDatum) => datum.count"
          :color="chartConfig.boards.color"
          :group-padding="0.18"
          :rounded-corners="4"
          :bar-min-height="2"
        />
        <VisAxis
          type="x"
          :tick-format="(value: number | Date) => chartData[Number(value)]?.label ?? ''"
          :num-ticks="chartData.length"
          :grid-line="false"
        />
        <VisAxis type="y" :grid-line="true" :num-ticks="4" />
        <ChartTooltip
          :triggers="{
            [VisGroupedBarSelectors.bar]: (datum: IntakeChartDatum) => tooltipTemplate(datum),
          }"
        />
      </VisXYContainer>
    </ChartContainer>
  </div>
</template>
