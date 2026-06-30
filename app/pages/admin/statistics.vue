<script setup lang="ts">
import { ChevronDownIcon } from 'lucide-vue-next';
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import type { AdminDashboardIntakePeriod, AdminDashboardResponse } from '~/utils/admin-dashboard';
import {
  ADMIN_DASHBOARD_INTAKE_PERIOD_OPTIONS,
  createEmptyAdminDashboardResponse,
  formatBoardCount,
  formatAdminDashboardDelta,
  formatAdminDashboardGeneratedAt,
  formatAdminDashboardMonthlyAverage,
  getAdminDashboardCurrentIntake,
  getAdminDashboardCurrentPeriodLabel,
  getAdminDashboardIntakePeriodLabel,
  getAdminDashboardIntakePoints,
  getAdminDashboardIntakeTotal,
  getAdminDashboardPreviousIntake,
  getAdminDashboardPreviousPeriodLabel,
} from '~/utils/admin-dashboard';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import { extractApiErrorEnvelope, getApiErrorStatusCode } from '~/utils/admin-work-orders';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: 'Statistics | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const lastSuccessfulResponse = shallowRef<AdminDashboardResponse | null>(null);
const selectedIntakePeriod = ref<AdminDashboardIntakePeriod>('weekly');
const isSurfboardBreakdownOpen = ref(false);

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const fetchDashboardStats = async () => {
  try {
    return await getRequestFetch()<AdminDashboardResponse>('/api/admin/dashboard');
  } catch (error) {
    const statusCode = getApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return lastSuccessfulResponse.value ?? createEmptyAdminDashboardResponse();
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData('admin-dashboard-statistics', fetchDashboardStats);

watch(
  data,
  (response) => {
    if (response) {
      lastSuccessfulResponse.value = response;
    }
  },
  { immediate: true },
);

const response = computed(
  () => data.value ?? lastSuccessfulResponse.value ?? createEmptyAdminDashboardResponse(),
);
const apiError = computed<ApiErrorEnvelope | null>(() => extractApiErrorEnvelope(error.value));
const isInitialLoading = computed(
  () => fetchStatus.value === 'pending' && !lastSuccessfulResponse.value,
);
const hasError = computed(() => fetchStatus.value === 'error');
const stats = computed(() => response.value.data.stats);
const summary = computed(() => response.value.data.summary);
const generatedAtLabel = computed(() =>
  formatAdminDashboardGeneratedAt(response.value.data.generatedAt),
);
const intakePoints = computed(() =>
  getAdminDashboardIntakePoints(stats.value, selectedIntakePeriod.value),
);
const currentIntake = computed(() =>
  getAdminDashboardCurrentIntake(stats.value, selectedIntakePeriod.value),
);
const previousIntake = computed(() =>
  getAdminDashboardPreviousIntake(stats.value, selectedIntakePeriod.value),
);
const intakeDeltaLabel = computed(() =>
  formatAdminDashboardDelta(currentIntake.value, previousIntake.value),
);
const currentPeriodLabel = computed(() =>
  getAdminDashboardCurrentPeriodLabel(selectedIntakePeriod.value),
);
const previousPeriodLabel = computed(() =>
  getAdminDashboardPreviousPeriodLabel(selectedIntakePeriod.value),
);
const intakePeriodLabel = computed(() =>
  getAdminDashboardIntakePeriodLabel(selectedIntakePeriod.value),
);
const intakeTotal = computed(() =>
  getAdminDashboardIntakeTotal(stats.value, selectedIntakePeriod.value),
);
const averageIntakeLabel = computed(() =>
  formatAdminDashboardMonthlyAverage(intakeTotal.value / 12),
);
const averageIntakeUnitLabel = computed(() =>
  selectedIntakePeriod.value === 'weekly' ? '週均' : '月均',
);
const topStats = computed(() => [
  {
    description: `${previousPeriodLabel.value} ${intakeDeltaLabel.value} 張板`,
    label: currentPeriodLabel.value,
    value: currentIntake.value,
  },
  {
    description: `${averageIntakeUnitLabel.value} ${averageIntakeLabel.value} 張板`,
    label: `${intakePeriodLabel.value}收件`,
    value: intakeTotal.value,
  },
  {
    description: '已收件、除濕中、維修中',
    label: '處理中工單',
    value: summary.value.activeWorkOrders,
  },
  {
    description: '已完工但尚未交件',
    label: '待取件',
    value: summary.value.readyForPickup,
  },
]);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Statistics</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">詳細統計</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            收件趨勢、目前狀態分布與近 12 個月板型分布，協助判斷現場工作量。
          </p>
        </div>

        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner v-if="fetchStatus === 'pending' && !isInitialLoading" />
          <span>最後更新：{{ generatedAtLabel }}</span>
        </div>
      </div>
    </div>

    <Alert v-if="hasError" variant="destructive">
      <AlertTitle>統計載入失敗</AlertTitle>
      <AlertDescription class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ apiError?.error.message ?? '目前無法取得詳細統計。' }}</span>
        <Button type="button" variant="outline" @click="refresh()">重試</Button>
      </AlertDescription>
    </Alert>

    <div v-if="isInitialLoading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card v-for="index in 4" :key="`stats-top-skeleton-${index}`">
        <CardHeader>
          <Skeleton class="h-4 w-24" />
          <Skeleton class="h-9 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton class="h-4 w-full" />
        </CardContent>
      </Card>
    </div>

    <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card v-for="item in topStats" :key="item.label">
        <CardHeader>
          <CardDescription>{{ item.label }}</CardDescription>
          <CardTitle class="text-3xl">{{ item.value }}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-6 text-muted-foreground">{{ item.description }}</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-1.5">
          <CardTitle>收件長條圖</CardTitle>
          <CardDescription>以收件日彙整每週或每月收板量。</CardDescription>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div class="flex rounded-md border bg-muted p-1">
            <Button
              v-for="option in ADMIN_DASHBOARD_INTAKE_PERIOD_OPTIONS"
              :key="option.value"
              type="button"
              size="sm"
              :variant="selectedIntakePeriod === option.value ? 'secondary' : 'ghost'"
              class="h-8 px-3"
              @click="selectedIntakePeriod = option.value"
            >
              {{ option.label }}
            </Button>
          </div>
          <Button as-child variant="outline" size="sm" class="w-fit">
            <NuxtLink to="/admin/work-orders/new">新增工單</NuxtLink>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton v-if="isInitialLoading" class="h-72 w-full" />
        <AdminIntakeBarChart v-else :points="intakePoints" :period="selectedIntakePeriod" />
      </CardContent>
    </Card>

    <div class="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>目前狀態分布</CardTitle>
          <CardDescription>以所有工單目前狀態計算，方便判斷卡在哪個階段。</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="isInitialLoading" class="space-y-4">
            <Skeleton v-for="index in 4" :key="`status-skeleton-${index}`" class="h-8 w-full" />
          </div>
          <div v-else class="space-y-4">
            <div v-for="item in stats.statusBreakdown" :key="item.key" class="space-y-2">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="font-medium">{{ item.label }}</span>
                <span class="tabular-nums text-muted-foreground"
                  >{{ formatBoardCount(item.count) }} · {{ item.share }}%</span
                >
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-chart-2" :style="{ width: `${item.share}%` }" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>近 12 個月板型</CardTitle>
          <CardDescription
            >只統計近 12 個月收件資料，衝浪板缺長度分類時不列入比例。</CardDescription
          >
        </CardHeader>
        <CardContent>
          <div v-if="isInitialLoading" class="space-y-4">
            <Skeleton v-for="index in 3" :key="`board-skeleton-${index}`" class="h-8 w-full" />
          </div>
          <div v-else class="space-y-4">
            <template v-for="item in stats.boardTypeBreakdown" :key="item.key">
              <Collapsible
                v-if="item.key === 'SURFBOARD'"
                v-model:open="isSurfboardBreakdownOpen"
                class="space-y-2"
              >
                <CollapsibleTrigger as-child>
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-md text-left text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span class="font-medium">{{ item.label }}</span>
                    <span class="flex items-center gap-2 tabular-nums text-muted-foreground">
                      {{ formatBoardCount(item.count) }} · {{ item.share }}%
                      <ChevronDownIcon
                        class="size-4 transition-transform"
                        :class="isSurfboardBreakdownOpen ? 'rotate-180' : ''"
                      />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-chart-1"
                    :style="{ width: `${item.share}%` }"
                  />
                </div>
                <CollapsibleContent class="pt-2">
                  <div class="space-y-3 rounded-md bg-muted/40 p-3">
                    <div
                      v-for="lengthItem in stats.surfboardLengthBreakdown"
                      :key="lengthItem.key"
                      class="space-y-2"
                    >
                      <div class="flex items-center justify-between gap-3 text-sm">
                        <span class="text-muted-foreground">{{ lengthItem.label }}</span>
                        <span class="tabular-nums text-muted-foreground">
                          {{ formatBoardCount(lengthItem.count) }} · {{ lengthItem.share }}%
                        </span>
                      </div>
                      <div class="h-2 overflow-hidden rounded-full bg-background">
                        <div
                          class="h-full rounded-full bg-chart-2"
                          :style="{ width: `${lengthItem.share}%` }"
                        />
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div v-else class="space-y-2">
                <div class="flex items-center justify-between gap-3 text-sm">
                  <span class="font-medium">{{ item.label }}</span>
                  <span class="tabular-nums text-muted-foreground"
                    >{{ formatBoardCount(item.count) }} · {{ item.share }}%</span
                  >
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-chart-1"
                    :style="{ width: `${item.share}%` }"
                  />
                </div>
              </div>
            </template>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
