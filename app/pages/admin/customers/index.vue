<script setup lang="ts">
import type {
  AdminCustomerApiErrorEnvelope,
  AdminCustomerListQueryState,
  AdminCustomerListResponse,
} from '~/utils/admin-customers';
import {
  ADMIN_CUSTOMER_LINE_STATUS_OPTIONS,
  ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS,
  ADMIN_CUSTOMER_LIST_SORT_OPTIONS,
  buildAdminCustomerListApiQuery,
  createEmptyAdminCustomerListResponse,
  extractAdminCustomerApiErrorEnvelope,
  getAdjustedPageForCustomerPageInfo,
  getAdminCustomerApiErrorStatusCode,
  getAdminCustomerDetailPath,
  getCustomerLineStatusMeta,
  getVisibleCustomerPageNumbers,
  hasActiveCustomerFilters,
  normalizeAdminCustomerListRouteQuery,
  serializeAdminCustomerListQuery,
} from '~/utils/admin-customers';
import { formatAdminDateTime, getWorkOrderStatusLabel } from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'admin-customers-query'],
});

useHead({
  title: '顧客管理 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const filterForm = reactive({
  lineStatus: 'all' as AdminCustomerListQueryState['lineStatus'],
  q: '',
});

const listQuery = computed(() => normalizeAdminCustomerListRouteQuery(route.query).query);
const requestKey = computed(() => JSON.stringify(buildAdminCustomerListApiQuery(listQuery.value)));
const lastSuccessfulResponse = shallowRef<AdminCustomerListResponse | null>(null);

watch(
  listQuery,
  (query) => {
    filterForm.q = query.q ?? '';
    filterForm.lineStatus = query.lineStatus;
  },
  { immediate: true },
);

const updateRouteQuery = async (
  query: AdminCustomerListQueryState,
  options: {
    replace?: boolean;
  } = {},
) => {
  const nextQuery = serializeAdminCustomerListQuery(query);
  const { canonicalQuery } = normalizeAdminCustomerListRouteQuery(nextQuery);
  const currentQuery = serializeAdminCustomerListQuery(listQuery.value);

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
    lineStatus: filterForm.lineStatus,
    page: 1,
    q: filterForm.q.trim() || undefined,
  });
};

const clearFilters = async () => {
  await updateRouteQuery({
    ...listQuery.value,
    lineStatus: 'all',
    page: 1,
    q: undefined,
  });
};

const handleLineStatusChange = (value: unknown) => {
  if (
    typeof value === 'string' &&
    ADMIN_CUSTOMER_LINE_STATUS_OPTIONS.some((option) => option.value === value)
  ) {
    filterForm.lineStatus = value as AdminCustomerListQueryState['lineStatus'];
    return;
  }

  filterForm.lineStatus = 'all';
};

const handleSortChange = async (value: unknown) => {
  if (typeof value !== 'string' || value === listQuery.value.sort) {
    return;
  }

  await updateRouteQuery({
    ...listQuery.value,
    page: 1,
    sort: value as AdminCustomerListQueryState['sort'],
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

const navigateToCustomer = async (id: string) => {
  await navigateTo(getAdminCustomerDetailPath(id));
};

const fetchCustomers = async () => {
  try {
    return await getRequestFetch()<AdminCustomerListResponse>('/api/admin/customers', {
      query: buildAdminCustomerListApiQuery(listQuery.value),
    });
  } catch (error) {
    const statusCode = getAdminCustomerApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return lastSuccessfulResponse.value ?? createEmptyAdminCustomerListResponse();
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData('admin-customer-list', fetchCustomers, {
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

    const adjustedPage = getAdjustedPageForCustomerPageInfo(page, data.value.pageInfo);

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
    createEmptyAdminCustomerListResponse(listQuery.value.page, listQuery.value.pageSize),
);

const apiError = computed<AdminCustomerApiErrorEnvelope | null>(() =>
  extractAdminCustomerApiErrorEnvelope(error.value),
);
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
const hasCustomers = computed(() => response.value.data.length > 0);
const isFiltered = computed(() => hasActiveCustomerFilters(listQuery.value));
const isFilteredEmpty = computed(
  () =>
    !hasCustomers.value &&
    isFiltered.value &&
    !hasBlockingError.value &&
    !hasValidationErrorWithoutData.value,
);
const isEmpty = computed(
  () =>
    !hasCustomers.value &&
    !isFiltered.value &&
    !hasBlockingError.value &&
    !hasValidationErrorWithoutData.value,
);
const visiblePages = computed(() =>
  getVisibleCustomerPageNumbers(response.value.pageInfo.page, response.value.pageInfo.totalPages),
);
const pageSummary = computed(() => {
  const { page, totalPages } = response.value.pageInfo;

  if (totalPages === 0) {
    return '第 1 / 0 頁';
  }

  return `第 ${page} / ${totalPages} 頁`;
});

const resultSummary = computed(() => `共 ${response.value.pageInfo.total} 位顧客`);

const formatNoteSummary = (note: string | null) => {
  const normalizedNote = note?.trim();

  if (!normalizedNote) {
    return '—';
  }

  return normalizedNote.length > 36 ? `${normalizedNote.slice(0, 36)}...` : normalizedNote;
};

const emitCustomerNavigation = async (id: string) => {
  await navigateToCustomer(id);
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Customers</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">顧客管理</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            依姓名、電話、備註與 LINE 綁定狀態查找顧客。
          </p>
        </div>

        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner v-if="isRefreshing" />
          <span>{{ resultSummary }}</span>
        </div>
      </div>
    </div>

    <Card>
      <CardHeader class="gap-3">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>查詢與篩選</CardTitle>
            <CardDescription>搜尋姓名、電話、備註，或依 LINE 綁定狀態縮小範圍。</CardDescription>
          </div>
          <Button size="sm" type="button" variant="ghost" @click="clearFilters">清除篩選</Button>
        </div>
      </CardHeader>

      <CardContent>
        <form
          class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
          @submit.prevent="applyFilters"
        >
          <Field>
            <FieldLabel for="customer-q">搜尋</FieldLabel>
            <Input
              id="customer-q"
              v-model="filterForm.q"
              autocomplete="off"
              name="q"
              placeholder="輸入姓名、電話或備註"
            />
            <FieldError :errors="validationFieldErrors.q" />
          </Field>

          <Field>
            <FieldLabel for="customer-line-status">LINE 狀態</FieldLabel>
            <Select
              :model-value="filterForm.lineStatus"
              @update:model-value="handleLineStatusChange"
            >
              <SelectTrigger id="customer-line-status" class="w-full">
                <SelectValue placeholder="全部 LINE 狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ADMIN_CUSTOMER_LINE_STATUS_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldError :errors="validationFieldErrors.lineStatus" />
          </Field>

          <div class="grid gap-2 self-end sm:grid-cols-2 xl:grid-cols-1">
            <Button type="submit" class="w-full">查詢</Button>
            <Button type="button" variant="outline" class="w-full" @click="clearFilters">
              清除篩選
            </Button>
          </div>

          <Field>
            <FieldLabel for="customer-sort">排序</FieldLabel>
            <Select :model-value="listQuery.sort" @update:model-value="handleSortChange">
              <SelectTrigger id="customer-sort" class="w-full">
                <SelectValue placeholder="選擇排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ADMIN_CUSTOMER_LIST_SORT_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel for="customer-page-size">每頁筆數</FieldLabel>
            <Select
              :model-value="String(listQuery.pageSize)"
              @update:model-value="handlePageSizeChange"
            >
              <SelectTrigger id="customer-page-size" class="w-full">
                <SelectValue placeholder="選擇每頁筆數" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS"
                  :key="option"
                  :value="String(option)"
                >
                  {{ option }} 筆
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </form>
      </CardContent>
    </Card>

    <Alert v-if="apiError" :variant="isValidationError ? 'destructive' : 'default'">
      <AlertTitle>
        {{ isValidationError ? '查詢條件有誤' : '載入顧客失敗' }}
      </AlertTitle>
      <AlertDescription class="space-y-2">
        <p>{{ apiError.error.message }}</p>
        <p v-if="apiError.error.requestId" class="text-xs text-muted-foreground">
          requestId: {{ apiError.error.requestId }}
        </p>
      </AlertDescription>
    </Alert>

    <template v-if="isInitialLoading">
      <Card>
        <CardContent class="space-y-4 pt-6">
          <Skeleton class="h-10 w-full" />
          <Skeleton v-for="index in 6" :key="index" class="h-14 w-full" />
        </CardContent>
      </Card>
    </template>

    <template v-else-if="hasBlockingError">
      <Card>
        <CardHeader>
          <CardTitle>目前無法載入顧客</CardTitle>
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
          <CardTitle>尚無顧客資料</CardTitle>
          <CardDescription>目前系統內還沒有可顯示的顧客。</CardDescription>
        </CardHeader>
      </Card>
    </template>

    <template v-else-if="isFilteredEmpty">
      <Card>
        <CardHeader>
          <CardTitle>無符合條件顧客</CardTitle>
          <CardDescription>請調整查詢條件，或清除篩選後重新查看。</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" @click="clearFilters">清除篩選</Button>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <div class="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-40">顧客姓名</TableHead>
              <TableHead class="w-36">電話</TableHead>
              <TableHead class="w-44">LINE 狀態</TableHead>
              <TableHead class="w-28 text-center">工單數</TableHead>
              <TableHead class="w-44">最新工單</TableHead>
              <TableHead class="min-w-56">備註摘要</TableHead>
              <TableHead class="w-40">更新時間</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <TableEmpty v-if="response.data.length === 0" :colspan="7">
              沒有可顯示的顧客。
            </TableEmpty>

            <TableRow
              v-for="customer in response.data"
              v-else
              :key="customer.id"
              class="cursor-pointer"
              role="link"
              tabindex="0"
              :aria-label="`查看顧客 ${customer.name}`"
              @click="emitCustomerNavigation(customer.id)"
              @keydown.enter.prevent="emitCustomerNavigation(customer.id)"
              @keydown.space.prevent="emitCustomerNavigation(customer.id)"
            >
              <TableCell class="font-medium">{{ customer.name }}</TableCell>
              <TableCell>{{ customer.phone }}</TableCell>
              <TableCell>
                <div class="flex flex-col gap-1">
                  <Badge
                    variant="outline"
                    class="w-fit"
                    :class="
                      getCustomerLineStatusMeta({
                        linked: customer.line.status === 'bound',
                        notifyStatus: customer.line.notificationStatus,
                      }).badgeClass
                    "
                  >
                    {{
                      getCustomerLineStatusMeta({
                        linked: customer.line.status === 'bound',
                        notifyStatus: customer.line.notificationStatus,
                      }).label
                    }}
                  </Badge>
                  <span
                    v-if="customer.line.status === 'bound' && customer.line.displayName"
                    class="text-xs text-muted-foreground"
                  >
                    {{ customer.line.displayName }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="text-center">
                <div class="flex flex-col gap-0.5">
                  <span>{{ customer.workOrderCount }}</span>
                  <span class="text-xs text-muted-foreground">
                    處理中 {{ customer.activeWorkOrderCount }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div v-if="customer.latestWorkOrder" class="flex flex-col gap-0.5">
                  <span class="font-medium">{{
                    customer.latestWorkOrder.paperOrderNo ?? '—'
                  }}</span>
                  <span class="text-xs text-muted-foreground">
                    {{ getWorkOrderStatusLabel(customer.latestWorkOrder.currentStatus) }}
                  </span>
                </div>
                <span v-else>—</span>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatNoteSummary(customer.note) }}
              </TableCell>
              <TableCell>{{ formatAdminDateTime(customer.updatedAt) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

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
