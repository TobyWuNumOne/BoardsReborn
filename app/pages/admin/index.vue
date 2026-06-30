<script setup lang="ts">
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import type {
  AdminDashboardProcessingCardDefinition,
  AdminDashboardResponse,
  AdminDashboardSummaryCardDefinition,
} from '~/utils/admin-dashboard';
import {
  ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS,
  ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS,
  createEmptyAdminDashboardResponse,
  formatAdminDashboardDelta,
  formatAdminDashboardGeneratedAt,
  formatAdminDashboardMonthlyAverage,
} from '~/utils/admin-dashboard';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import { extractApiErrorEnvelope, getApiErrorStatusCode } from '~/utils/admin-work-orders';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: 'Admin Workspace | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const lastSuccessfulResponse = shallowRef<AdminDashboardResponse | null>(null);

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const fetchDashboardSummary = async () => {
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
} = await useAsyncData('admin-dashboard-summary', fetchDashboardSummary);

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
const generatedAtLabel = computed(() =>
  formatAdminDashboardGeneratedAt(response.value.data.generatedAt),
);
const processingCards = computed<Array<AdminDashboardProcessingCardDefinition & { value: number }>>(
  () =>
    ADMIN_DASHBOARD_PROCESSING_CARD_DEFINITIONS.map((card) => ({
      ...card,
      value: response.value.data.summary.activeWorkOrdersByStatus[card.key],
    })),
);
const summaryCards = computed<Array<AdminDashboardSummaryCardDefinition & { value: number }>>(() =>
  ADMIN_DASHBOARD_SUMMARY_CARD_DEFINITIONS.map((card) => ({
    ...card,
    value: response.value.data.summary[card.key],
  })),
);
const stats = computed(() => response.value.data.stats);
const receivedMonthDeltaLabel = computed(() =>
  formatAdminDashboardDelta(stats.value.receivedThisMonth, stats.value.receivedPreviousMonth),
);
const averageMonthlyIntakeLabel = computed(() =>
  formatAdminDashboardMonthlyAverage(stats.value.averageMonthlyIntake),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Dashboard</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">管理端工作區</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            主要統計、處理中工單與收件趨勢，讓你快速掌握現場進度與待追蹤項目。
          </p>
        </div>

        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner v-if="fetchStatus === 'pending' && !isInitialLoading" />
          <span>最後更新：{{ generatedAtLabel }}</span>
        </div>
      </div>
    </div>

    <Alert v-if="hasError" variant="destructive">
      <AlertTitle>Dashboard 載入失敗</AlertTitle>
      <AlertDescription class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ apiError?.error.message ?? '目前無法取得管理 summary。' }}</span>
        <Button type="button" variant="outline" @click="refresh()">重試</Button>
      </AlertDescription>
    </Alert>

    <div class="grid gap-6 xl:grid-cols-2 xl:items-stretch">
      <Card class="xl:col-span-2">
        <CardHeader class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-1.5">
            <CardTitle>月收件趨勢</CardTitle>
            <CardDescription
              >以收件日計算近 12 個月變化；詳細統計頁可看更多 breakdown。</CardDescription
            >
          </div>
          <Button as-child variant="outline" size="sm" class="w-fit">
            <NuxtLink to="/admin/statistics">查看詳細統計</NuxtLink>
          </Button>
        </CardHeader>
        <CardContent>
          <div v-if="isInitialLoading" class="grid gap-4 lg:grid-cols-[1fr_16rem]">
            <Skeleton class="h-72 w-full" />
            <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Skeleton v-for="index in 3" :key="`trend-skeleton-${index}`" class="h-24 w-full" />
            </div>
          </div>

          <div v-else class="grid gap-4 lg:grid-cols-[1fr_16rem]">
            <AdminMonthlyIntakeChart :points="stats.monthlyIntake" />
            <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div class="rounded-lg border p-4">
                <p class="text-sm text-muted-foreground">本月收件</p>
                <p class="mt-3 text-3xl font-semibold tracking-tight">
                  {{ stats.receivedThisMonth }}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  較上月 {{ receivedMonthDeltaLabel }} 件
                </p>
              </div>
              <div class="rounded-lg border p-4">
                <p class="text-sm text-muted-foreground">近 12 個月</p>
                <p class="mt-3 text-3xl font-semibold tracking-tight">
                  {{ stats.last12MonthsIntake }}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  月均 {{ averageMonthlyIntakeLabel }} 件
                </p>
              </div>
              <div class="rounded-lg border p-4">
                <p class="text-sm text-muted-foreground">最高月份</p>
                <p class="mt-3 text-2xl font-semibold tracking-tight">
                  {{ stats.busiestMonth?.label ?? '—' }}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  {{ stats.busiestMonth ? `${stats.busiestMonth.count} 件` : '尚無資料' }}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="flex flex-col xl:col-start-1 xl:row-start-2 xl:h-full">
        <CardHeader class="flex flex-row items-start justify-between gap-4">
          <div class="space-y-1.5">
            <CardTitle>處理中工單</CardTitle>
            <CardDescription
              >把進行中的工單拆成已收件、除濕中與維修中，方便直接進入對應清單。</CardDescription
            >
          </div>
          <div class="text-right">
            <p class="text-sm text-muted-foreground">總數</p>
            <div v-if="isInitialLoading" class="flex justify-end">
              <Skeleton class="h-8 w-16" />
            </div>
            <p v-else class="text-3xl font-semibold tracking-tight">
              {{ response.data.summary.activeWorkOrders }}
            </p>
          </div>
        </CardHeader>
        <CardContent class="flex-1">
          <div v-if="isInitialLoading" class="grid gap-3 md:grid-cols-3 xl:h-full xl:auto-rows-fr">
            <div
              v-for="index in 3"
              :key="`processing-skeleton-${index}`"
              class="rounded-lg border p-4 xl:h-full"
            >
              <Skeleton class="h-4 w-16" />
              <Skeleton class="mt-4 h-8 w-12" />
              <Skeleton class="mt-3 h-4 w-full" />
            </div>
          </div>

          <div v-else class="grid gap-3 md:grid-cols-3 xl:h-full xl:auto-rows-fr">
            <NuxtLink
              v-for="card in processingCards"
              :key="card.key"
              :to="card.to"
              class="flex h-full flex-col rounded-lg border p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <p class="text-sm font-medium text-foreground">{{ card.label }}</p>
              <p class="mt-4 text-3xl font-semibold tracking-tight">{{ card.value }}</p>
              <p class="mt-3 text-sm leading-6 text-muted-foreground">{{ card.description }}</p>
            </NuxtLink>
          </div>
        </CardContent>
      </Card>

      <div
        v-if="isInitialLoading"
        class="grid gap-3 md:grid-cols-3 xl:col-start-2 xl:row-start-2 xl:h-full xl:grid-cols-1"
      >
        <Card v-for="index in 3" :key="`summary-skeleton-${index}`" data-size="sm">
          <CardHeader>
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-8 w-18" />
          </CardHeader>
          <CardContent>
            <Skeleton class="h-4 w-full" />
          </CardContent>
        </Card>
      </div>

      <div
        v-else
        class="grid gap-3 md:grid-cols-3 xl:col-start-2 xl:row-start-2 xl:h-full xl:grid-cols-1"
      >
        <Card
          v-for="card in summaryCards"
          :key="card.key"
          data-size="sm"
          :class="card.to ? 'transition-colors hover:bg-muted/30 hover:ring-foreground/20' : ''"
        >
          <NuxtLink
            v-if="card.to"
            :to="card.to"
            class="flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <CardHeader>
              <CardDescription>{{ card.label }}</CardDescription>
              <CardTitle class="text-2xl">{{ card.value }}</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm leading-6 text-muted-foreground">{{ card.description }}</p>
            </CardContent>
          </NuxtLink>

          <template v-else>
            <CardHeader>
              <CardDescription>{{ card.label }}</CardDescription>
              <CardTitle class="text-2xl">{{ card.value }}</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm leading-6 text-muted-foreground">{{ card.description }}</p>
            </CardContent>
          </template>
        </Card>
      </div>

      <Card class="xl:col-start-1 xl:row-start-3">
        <CardHeader>
          <CardTitle>Quick entries</CardTitle>
          <CardDescription
            >先保留最常用入口；工單列表、建單頁與批量狀態都可直接進入。</CardDescription
          >
        </CardHeader>
        <CardContent>
          <div class="grid gap-3 sm:grid-cols-2">
            <Button as-child variant="outline" class="justify-start">
              <NuxtLink to="/admin/work-orders">工單列表</NuxtLink>
            </Button>
            <Button as-child variant="outline" class="justify-start">
              <NuxtLink to="/admin/work-orders/new">新增工單</NuxtLink>
            </Button>
            <Button as-child variant="outline" class="justify-start">
              <NuxtLink to="/admin/work-orders/bulk-status">批量狀態</NuxtLink>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
