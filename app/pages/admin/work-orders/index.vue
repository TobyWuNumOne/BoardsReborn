<script setup lang="ts">
import type {
  AdminWorkOrderListQueryState,
  AdminWorkOrderListResponse,
  ApiErrorEnvelope,
} from '~/utils/admin-work-orders';
import type { Database } from '../../../../types/database.types';
import {
  ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS,
  ADMIN_WORK_ORDER_LIST_SORT_OPTIONS,
  ADMIN_WORK_ORDER_STATUS_OPTIONS,
  buildAdminWorkOrderListApiQuery,
  createEmptyAdminWorkOrderListResponse,
  extractApiErrorEnvelope,
  getAdjustedPageForPageInfo,
  getAdminWorkOrderDetailPath,
  getApiErrorStatusCode,
  getVisiblePageNumbers,
  hasActiveFilters,
  hasAdvancedFilters,
  normalizeAdminWorkOrderListRouteQuery,
  serializeAdminWorkOrderListQuery,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import WorkOrderListTable from '~/components/work-orders/WorkOrderListTable.vue';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];
type WorkOrderFilterStatusValue = WorkOrderStatus | typeof ALL_STATUS_OPTION;

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

const ALL_STATUS_OPTION = '__ALL__';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'admin-work-orders-query'],
});

useHead({
  title: '工單列表 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const showAdvancedFilters = ref(false);
const filterForm = reactive<{
  customerPhone: string;
  overdueEstimatedCompletion: boolean;
  pickupOverdue: boolean;
  q: string;
  staleReceived: boolean;
  status: WorkOrderFilterStatusValue;
}>({
  customerPhone: '',
  overdueEstimatedCompletion: false,
  pickupOverdue: false,
  q: '',
  staleReceived: false,
  status: ALL_STATUS_OPTION,
});
const workOrderStatusValues = new Set<WorkOrderStatus>(
  ADMIN_WORK_ORDER_STATUS_OPTIONS.map((option) => option.value),
);

const listQuery = computed(() => normalizeAdminWorkOrderListRouteQuery(route.query).query);
const requestKey = computed(() => JSON.stringify(buildAdminWorkOrderListApiQuery(listQuery.value)));
const lastSuccessfulResponse = shallowRef<AdminWorkOrderListResponse | null>(null);

const syncFilterForm = (query: AdminWorkOrderListQueryState) => {
  filterForm.q = query.q ?? '';
  filterForm.status = query.status ?? ALL_STATUS_OPTION;
  filterForm.customerPhone = query.customerPhone ?? '';
  filterForm.overdueEstimatedCompletion = query.overdueEstimatedCompletion;
  filterForm.pickupOverdue = query.pickupOverdue;
  filterForm.staleReceived = query.staleReceived;
};

watch(
  listQuery,
  (query) => {
    syncFilterForm(query);

    if (hasAdvancedFilters(query)) {
      showAdvancedFilters.value = true;
    }
  },
  { immediate: true },
);

const updateRouteQuery = async (
  query: AdminWorkOrderListQueryState,
  options: {
    replace?: boolean;
  } = {},
) => {
  const nextQuery = serializeAdminWorkOrderListQuery(query);
  const { canonicalQuery } = normalizeAdminWorkOrderListRouteQuery(nextQuery);
  const currentQuery = serializeAdminWorkOrderListQuery(listQuery.value);

  if (JSON.stringify(canonicalQuery) === JSON.stringify(currentQuery)) {
    return;
  }

  await navigateTo(
    {
      path: route.path,
      query: canonicalQuery,
    },
    {
      replace: options.replace ?? false,
    },
  );
};

const applyFilters = async () => {
  await updateRouteQuery({
    ...listQuery.value,
    customerPhone: filterForm.customerPhone.trim() || undefined,
    overdueEstimatedCompletion: filterForm.overdueEstimatedCompletion,
    page: 1,
    pickupOverdue: filterForm.pickupOverdue,
    q: filterForm.q.trim() || undefined,
    staleReceived: filterForm.staleReceived,
    status: filterForm.status === ALL_STATUS_OPTION ? undefined : filterForm.status,
  });
};

const handleStatusChange = (value: unknown) => {
  if (value === ALL_STATUS_OPTION) {
    filterForm.status = ALL_STATUS_OPTION;
    return;
  }

  if (typeof value === 'string' && workOrderStatusValues.has(value as WorkOrderStatus)) {
    filterForm.status = value as WorkOrderStatus;
    return;
  }

  filterForm.status = ALL_STATUS_OPTION;
};

const clearFilters = async () => {
  showAdvancedFilters.value = false;

  await updateRouteQuery({
    ...listQuery.value,
    customerPhone: undefined,
    overdueEstimatedCompletion: false,
    page: 1,
    pickupOverdue: false,
    q: undefined,
    staleReceived: false,
    status: undefined,
  });
};

const handleSortChange = async (value: unknown) => {
  if (typeof value !== 'string') {
    return;
  }

  if (value === listQuery.value.sort) {
    return;
  }

  await updateRouteQuery({
    ...listQuery.value,
    page: 1,
    sort: value as AdminWorkOrderListQueryState['sort'],
  });
};

const handlePageSizeChange = async (value: unknown) => {
  if (typeof value !== 'string') {
    return;
  }

  const nextPageSize = Number(value);

  if (Number.isNaN(nextPageSize) || nextPageSize === listQuery.value.pageSize) {
    return;
  }

  await updateRouteQuery({
    ...listQuery.value,
    page: 1,
    pageSize: nextPageSize,
  });
};

const goToPage = async (page: number) => {
  if (page === listQuery.value.page) {
    return;
  }

  await updateRouteQuery({
    ...listQuery.value,
    page,
  });
};

const navigateToCreate = async () => {
  await navigateTo('/admin/work-orders/new');
};

const navigateToBulkStatus = async () => {
  await navigateTo('/admin/work-orders/bulk-status');
};

const navigateToDetail = async (id: string) => {
  await navigateTo(getAdminWorkOrderDetailPath(id));
};

const fetchWorkOrders = async () => {
  try {
    return await getRequestFetch()<AdminWorkOrderListResponse>('/api/admin/work-orders', {
      query: buildAdminWorkOrderListApiQuery(listQuery.value),
    });
  } catch (error) {
    const statusCode = getApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return lastSuccessfulResponse.value ?? createEmptyAdminWorkOrderListResponse();
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData('admin-work-order-list', fetchWorkOrders, {
  watch: [requestKey],
});

watch(
  data,
  (response) => {
    if (response) {
      lastSuccessfulResponse.value = response;
    }
  },
  { immediate: true },
);

watch(
  [() => data.value?.pageInfo.totalPages, () => listQuery.value.page],
  async ([totalPages, page]) => {
    if (!data.value || typeof totalPages !== 'number') {
      return;
    }

    const adjustedPage = getAdjustedPageForPageInfo(page, data.value.pageInfo);

    if (!adjustedPage || adjustedPage === page) {
      return;
    }

    await updateRouteQuery(
      {
        ...listQuery.value,
        page: adjustedPage,
      },
      { replace: true },
    );
  },
  { immediate: true },
);

const response = computed(
  () =>
    data.value ??
    lastSuccessfulResponse.value ??
    createEmptyAdminWorkOrderListResponse(listQuery.value.page, listQuery.value.pageSize),
);

const apiError = computed<ApiErrorEnvelope | null>(() => extractApiErrorEnvelope(error.value));
const validationFieldErrors = computed<Record<string, string[]>>(
  () => apiError.value?.error.fieldErrors ?? {},
);
const isValidationError = computed(
  () => fetchStatus.value === 'error' && apiError.value?.error.code === 'VALIDATION_ERROR',
);
const isInitialLoading = computed(
  () => fetchStatus.value === 'pending' && !lastSuccessfulResponse.value,
);
const isRefreshing = computed(
  () => fetchStatus.value === 'pending' && Boolean(lastSuccessfulResponse.value),
);
const hasBlockingError = computed(
  () => fetchStatus.value === 'error' && !lastSuccessfulResponse.value && !isValidationError.value,
);
const hasValidationErrorWithoutData = computed(
  () => isValidationError.value && !lastSuccessfulResponse.value,
);
const hasWorkOrders = computed(() => response.value.data.length > 0);
const isFiltered = computed(() => hasActiveFilters(listQuery.value));
const isFilteredEmpty = computed(
  () =>
    !hasWorkOrders.value &&
    isFiltered.value &&
    !hasBlockingError.value &&
    !hasValidationErrorWithoutData.value,
);
const isEmpty = computed(
  () =>
    !hasWorkOrders.value &&
    !isFiltered.value &&
    !hasBlockingError.value &&
    !hasValidationErrorWithoutData.value,
);
const visiblePages = computed(() =>
  getVisiblePageNumbers(response.value.pageInfo.page, response.value.pageInfo.totalPages),
);
const pageSummary = computed(() => {
  const { page, totalPages } = response.value.pageInfo;

  if (totalPages === 0) {
    return '第 1 / 0 頁';
  }

  return `第 ${page} / ${totalPages} 頁`;
});

const resultSummary = computed(() => `共 ${response.value.pageInfo.total} 筆工單`);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Work orders</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">工單列表</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            用工單號、狀態、完整手機號碼與提醒條件篩選目前工單。
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner v-if="isRefreshing" />
            <span>{{ resultSummary }}</span>
          </div>
          <Button type="button" variant="outline" class="w-full sm:w-auto" @click="navigateToBulkStatus">
            批量狀態
          </Button>
          <Button type="button" class="w-full sm:w-auto" @click="navigateToCreate">新增工單</Button>
        </div>
      </div>
    </div>

    <Card>
      <CardHeader class="gap-3">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>查詢與篩選</CardTitle>
            <CardDescription>
              使用工單號搜尋、狀態、完整手機號碼，以及提醒條件篩選。
            </CardDescription>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              @click="showAdvancedFilters = !showAdvancedFilters"
            >
              {{ showAdvancedFilters ? '收合進階篩選' : '展開進階篩選' }}
            </Button>
            <Button size="sm" type="button" variant="ghost" @click="clearFilters">
              清除篩選
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="applyFilters">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field>
              <FieldLabel for="work-order-q">工單號</FieldLabel>
              <Input
                id="work-order-q"
                v-model="filterForm.q"
                autocomplete="off"
                name="q"
                placeholder="例如 260001"
              />
              <FieldError :errors="validationFieldErrors.q" />
            </Field>

            <Field>
              <FieldLabel for="work-order-status">狀態</FieldLabel>
              <Select :model-value="filterForm.status" @update:model-value="handleStatusChange">
                <SelectTrigger id="work-order-status" class="w-full">
                  <SelectValue placeholder="全部狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="ALL_STATUS_OPTION">全部狀態</SelectItem>
                  <SelectItem
                    v-for="option in ADMIN_WORK_ORDER_STATUS_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError :errors="validationFieldErrors.status" />
            </Field>

            <Field>
              <FieldLabel for="customer-phone">顧客手機</FieldLabel>
              <Input
                id="customer-phone"
                v-model="filterForm.customerPhone"
                autocomplete="tel"
                inputmode="tel"
                name="customerPhone"
                placeholder="輸入完整 09xxxxxxxx"
              />
              <FieldError :errors="validationFieldErrors.customerPhone" />
            </Field>

            <div class="grid gap-2 self-end sm:grid-cols-2 xl:grid-cols-1">
              <Button type="submit" class="w-full">查詢</Button>
              <Button type="button" variant="outline" class="w-full" @click="clearFilters">
                清除篩選
              </Button>
            </div>
          </div>

          <div
            v-if="showAdvancedFilters"
            class="grid gap-4 rounded-lg border border-dashed bg-muted/20 p-4 md:grid-cols-3"
          >
            <Field class="gap-2">
              <div class="flex items-start gap-3">
                <Checkbox
                  id="overdue-estimated-completion"
                  v-model="filterForm.overdueEstimatedCompletion"
                  class="mt-0.5"
                />
                <div class="space-y-1">
                  <FieldLabel for="overdue-estimated-completion">超過預估日</FieldLabel>
                  <p class="text-sm text-muted-foreground">只看已超過預估完成日的工單。</p>
                </div>
              </div>
              <FieldError :errors="validationFieldErrors.overdueEstimatedCompletion" />
            </Field>

            <Field class="gap-2">
              <div class="flex items-start gap-3">
                <Checkbox id="pickup-overdue" v-model="filterForm.pickupOverdue" class="mt-0.5" />
                <div class="space-y-1">
                  <FieldLabel for="pickup-overdue">待取件超時</FieldLabel>
                  <p class="text-sm text-muted-foreground">通知後超過 14 天仍未取件。</p>
                </div>
              </div>
              <FieldError :errors="validationFieldErrors.pickupOverdue" />
            </Field>

            <Field class="gap-2">
              <div class="flex items-start gap-3">
                <Checkbox id="stale-received" v-model="filterForm.staleReceived" class="mt-0.5" />
                <div class="space-y-1">
                  <FieldLabel for="stale-received">未開工過久</FieldLabel>
                  <p class="text-sm text-muted-foreground">已收件超過 7 天仍未進入除濕或維修。</p>
                </div>
              </div>
              <FieldError :errors="validationFieldErrors.staleReceived" />
            </Field>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel for="work-order-sort">排序</FieldLabel>
              <Select :model-value="listQuery.sort" @update:model-value="handleSortChange">
                <SelectTrigger id="work-order-sort" class="w-full">
                  <SelectValue placeholder="選擇排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in ADMIN_WORK_ORDER_LIST_SORT_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel for="work-order-page-size">每頁筆數</FieldLabel>
              <Select
                :model-value="String(listQuery.pageSize)"
                @update:model-value="handlePageSizeChange"
              >
                <SelectTrigger id="work-order-page-size" class="w-full">
                  <SelectValue placeholder="選擇每頁筆數" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in ADMIN_WORK_ORDER_LIST_PAGE_SIZE_OPTIONS"
                    :key="option"
                    :value="String(option)"
                  >
                    {{ option }} 筆
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </form>
      </CardContent>
    </Card>

    <Alert v-if="apiError" :variant="isValidationError ? 'destructive' : 'default'">
      <AlertTitle>
        {{ isValidationError ? '查詢條件有誤' : '載入工單失敗' }}
      </AlertTitle>
      <AlertDescription class="space-y-2">
        <p>{{ apiError.error.message }}</p>
        <p v-if="apiError.error.requestId" class="text-xs text-muted-foreground">
          requestId: {{ apiError.error.requestId }}
        </p>
      </AlertDescription>
    </Alert>

    <template v-if="isInitialLoading">
      <Card class="hidden xl:block">
        <CardContent class="space-y-4 pt-6">
          <Skeleton class="h-10 w-full" />
          <Skeleton v-for="index in 6" :key="index" class="h-14 w-full" />
        </CardContent>
      </Card>

      <div class="grid gap-3 xl:hidden">
        <Card v-for="index in 3" :key="index">
          <CardContent class="space-y-3 pt-6">
            <Skeleton class="h-5 w-32" />
            <Skeleton class="h-4 w-48" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="hasBlockingError">
      <Card>
        <CardHeader>
          <CardTitle>目前無法載入工單</CardTitle>
          <CardDescription>請稍後重試，或確認目前查詢條件是否正確。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" @click="refresh">重新載入</Button>
        </CardContent>
      </Card>
    </template>

    <template v-else-if="hasValidationErrorWithoutData">
      <Card>
        <CardHeader>
          <CardTitle>請調整查詢條件</CardTitle>
          <CardDescription>目前查詢條件未通過 API 驗證，修正後再重新查詢。</CardDescription>
        </CardHeader>
      </Card>
    </template>

    <template v-else-if="isEmpty">
      <Card>
        <CardHeader>
          <CardTitle>尚無工單資料</CardTitle>
          <CardDescription>目前系統內還沒有可顯示的工單。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" @click="navigateToCreate">新增第一筆工單</Button>
        </CardContent>
      </Card>
    </template>

    <template v-else-if="isFilteredEmpty">
      <Card>
        <CardHeader>
          <CardTitle>無符合條件工單</CardTitle>
          <CardDescription>請調整查詢條件，或清除篩選後重新查看。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" @click="clearFilters">清除篩選</Button>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <WorkOrderListTable :items="response.data" @view="navigateToDetail" />

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between text-sm text-muted-foreground">
          <span>{{ resultSummary }}</span>
          <span>{{ pageSummary }}</span>
        </div>

        <div class="hidden items-center justify-center gap-2 xl:flex">
          <Button
            :disabled="!response.pageInfo.hasPreviousPage"
            type="button"
            variant="outline"
            @click="goToPage(response.pageInfo.page - 1)"
          >
            Previous
          </Button>
          <Button
            v-for="pageNumber in visiblePages"
            :key="pageNumber"
            :variant="pageNumber === response.pageInfo.page ? 'default' : 'outline'"
            type="button"
            @click="goToPage(pageNumber)"
          >
            {{ pageNumber }}
          </Button>
          <Button
            :disabled="!response.pageInfo.hasNextPage"
            type="button"
            variant="outline"
            @click="goToPage(response.pageInfo.page + 1)"
          >
            Next
          </Button>
        </div>

        <div class="flex items-center justify-between gap-2 xl:hidden">
          <Button
            :disabled="!response.pageInfo.hasPreviousPage"
            type="button"
            variant="outline"
            @click="goToPage(response.pageInfo.page - 1)"
          >
            上一頁
          </Button>
          <Button
            :disabled="!response.pageInfo.hasNextPage"
            type="button"
            variant="outline"
            @click="goToPage(response.pageInfo.page + 1)"
          >
            下一頁
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>
