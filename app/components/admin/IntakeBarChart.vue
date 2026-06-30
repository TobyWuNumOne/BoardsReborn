<script setup lang="ts">
import type {
  AdminDashboardIntakePeriod,
  AdminDashboardMonthlyIntakePoint,
  AdminDashboardWeeklyIntakePoint,
} from '~/utils/admin-dashboard';
import { getAdminDashboardIntakePeriodLabel } from '~/utils/admin-dashboard';

type IntakePoint = AdminDashboardMonthlyIntakePoint | AdminDashboardWeeklyIntakePoint;

defineProps<{
  period: AdminDashboardIntakePeriod;
  points: IntakePoint[];
}>();
</script>

<template>
  <ClientOnly>
    <AdminIntakeBarChartClient :period="period" :points="points" />
    <template #fallback>
      <div class="h-full min-h-72 w-full overflow-hidden rounded-lg border bg-card p-4">
        <div
          class="flex h-64 items-center justify-center px-4 text-sm text-muted-foreground"
        >
          <template v-if="points.length === 0">
            尚無{{ getAdminDashboardIntakePeriodLabel(period) }}收件資料
          </template>
          <template v-else>圖表載入中</template>
        </div>
      </div>
    </template>
  </ClientOnly>
</template>
