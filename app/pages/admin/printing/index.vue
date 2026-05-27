<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import {
  extractApiErrorEnvelope,
  formatAdminDateTime,
  getAdjustedPageForPageInfo,
  getApiErrorStatusCode,
  getBoardLengthClassLabel,
  getBoardTypeLabel,
  getVisiblePageNumbers,
  getAdminWorkOrderDetailPath,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import type {
  AdminPrintJobListQueryState,
  AdminPrintJobListResponse,
} from '~/utils/admin-printing';
import {
  ADMIN_PRINT_JOB_SORT_OPTIONS,
  ADMIN_PRINT_JOB_STATUS_OPTIONS,
  ADMIN_PRINT_LIST_PAGE_SIZE_OPTIONS,
  buildAdminPrintJobListApiQuery,
  createEmptyAdminPrintJobListResponse,
  getPrintJobStatusTone,
  getPrintJobTypeLabel,
  hasActiveAdminPrintJobFilters,
  normalizeAdminPrintJobListRouteQuery,
  serializeAdminPrintJobListQuery,
} from '~/utils/admin-printing';
import { ADMIN_PRINTING_REALTIME_TOPICS } from '~/utils/admin-printing-realtime';
import PrintJobStatusBadge from '~/components/printing/PrintJobStatusBadge.vue';
import PrintStatusLight from '~/components/printing/PrintStatusLight.vue';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

const ALL_STATUS_OPTION = '__ALL__';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'admin-print-jobs-query'],
});

useHead({
  title: '列印中心 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const filterForm = reactive<{
  paperOrderNo: string;
  status: (typeof ALL_STATUS_OPTION) | (typeof ADMIN_PRINT_JOB_STATUS_OPTIONS)[number]['value'];
}>({
  paperOrderNo: '',
  status: ALL_STATUS_OPTION,
});
const retryingJobIds = ref<string[]>([]);
const printJobStatusValues = new Set<(typeof ADMIN_PRINT_JOB_STATUS_OPTIONS)[number]['value']>(
  ADMIN_PRINT_JOB_STATUS_OPTIONS.map((option) => option.value),
);
const listQuery = computed(() => normalizeAdminPrintJobListRouteQuery(route.query).query);
const requestKey = computed(() => JSON.stringify(buildAdminPrintJobListApiQuery(listQuery.value)));
const lastSuccessfulResponse = shallowRef<AdminPrintJobListResponse | null>(null);

const syncFilterForm = (query: AdminPrintJobListQueryState) => {
  filterForm.paperOrderNo = query.paperOrderNo ?? '';
  filterForm.status = query.status ?? ALL_STATUS_OPTION;
};

watch(
  listQuery,
  (query) => {
    syncFilterForm(query);
  },
  { immediate: true },
);

const updateRouteQuery = async (
  query: AdminPrintJobListQueryState,
  options: {
    replace?: boolean;
  } = {},
) => {
  const nextQuery = serializeAdminPrintJobListQuery(query);
  const { canonicalQuery } = normalizeAdminPrintJobListRouteQuery(nextQuery);
  const currentQuery = serializeAdminPrintJobListQuery(listQuery.value);

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
    page: 1,
    paperOrderNo: filterForm.paperOrderNo.trim() || undefined,
    status: filterForm.status === ALL_STATUS_OPTION ? undefined : filterForm.status,
  });
};

const clearFilters = async () => {
  await updateRouteQuery({
    ...listQuery.value,
    page: 1,
    paperOrderNo: undefined,
    status: undefined,
  });
};

const handleStatusChange = (value: unknown) => {
  if (value === ALL_STATUS_OPTION) {
    filterForm.status = ALL_STATUS_OPTION;
    return;
  }

  if (
    typeof value === 'string' &&
    printJobStatusValues.has(value as (typeof ADMIN_PRINT_JOB_STATUS_OPTIONS)[number]['value'])
  ) {
    filterForm.status = value as (typeof ADMIN_PRINT_JOB_STATUS_OPTIONS)[number]['value'];
    return;
  }

  filterForm.status = ALL_STATUS_OPTION;
};

const handleSortChange = async (value: unknown) => {
  if (typeof value !== 'string' || value === listQuery.value.sort) {
    return;
  }

  await updateRouteQuery({
    ...listQuery.value,
    page: 1,
    sort: value as AdminPrintJobListQueryState['sort'],
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

const navigateToWorkers = async () => {
  await navigateTo('/admin/printing/workers');
};

const fetchPrintJobs = async () => {
  try {
    return await getRequestFetch()<AdminPrintJobListResponse>('/api/admin/print-jobs', {
      query: buildAdminPrintJobListApiQuery(listQuery.value),
    });
  } catch (error) {
    const statusCode = getApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return (
        lastSuccessfulResponse.value ??
        createEmptyAdminPrintJobListResponse(listQuery.value.page, listQuery.value.pageSize)
      );
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData('admin-print-jobs', fetchPrintJobs, {
  watch: [requestKey],
});

const refreshPrintJobs = async ({ force = false }: { force?: boolean } = {}) => {
  if (!force && fetchStatus.value === 'pending') {
    return;
  }

  await refresh();
};

const realtimeSync = useAdminPrintingRealtime({
  onRefresh: () => refreshPrintJobs(),
  topics: ADMIN_PRINTING_REALTIME_TOPICS,
});

watch(
  data,
  (response) => {
    if (response) {
      lastSuccessfulResponse.value = response;
      realtimeSync.markSynchronized();
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
    createEmptyAdminPrintJobListResponse(listQuery.value.page, listQuery.value.pageSize),
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
const hasPrintJobs = computed(() => response.value.data.length > 0);
const isFiltered = computed(() => hasActiveAdminPrintJobFilters(listQuery.value));
const isFilteredEmpty = computed(
  () =>
    !hasPrintJobs.value &&
    isFiltered.value &&
    !hasBlockingError.value &&
    !hasValidationErrorWithoutData.value,
);
const isEmpty = computed(
  () =>
    !hasPrintJobs.value &&
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
const resultSummary = computed(() => `共 ${response.value.pageInfo.total} 筆列印任務`);

const handleRetry = async (id: string) => {
  if (retryingJobIds.value.includes(id)) {
    return;
  }

  retryingJobIds.value = [...retryingJobIds.value, id];

  try {
    await getRequestFetch()(`/api/admin/print-jobs/${id}/retry`, {
      method: 'POST',
    });
    toast.success('列印任務已重新排入佇列。');
    await refreshPrintJobs({ force: true });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    toast.error('重新排入列印佇列失敗。', {
      description: extractApiErrorEnvelope(error)?.error.message ?? '請稍後再試一次。',
    });
  } finally {
    retryingJobIds.value = retryingJobIds.value.filter((jobId) => jobId !== id);
  }
};

const handleAuthRedirect = async (error: unknown) => {
  const statusCode = getApiErrorStatusCode(error);

  if (statusCode !== 401 && statusCode !== 403) {
    return false;
  }

  const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
  const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

  if (redirectTarget) {
    await navigateTo(redirectTarget);
  }

  return true;
};

const getBoardSummary = (item: AdminPrintJobListResponse['data'][number]) => {
  const boardTypeLabel = getBoardTypeLabel(item.board.boardType);
  const boardLengthLabel = item.board.boardType === 'SURFBOARD'
    ? getBoardLengthClassLabel(item.board.boardLengthClass)
    : '—';

  return `${boardTypeLabel} / ${boardLengthLabel}`;
};

const isRetrying = (id: string) => retryingJobIds.value.includes(id);
const getPrintJobLightTone = (status: AdminPrintJobListResponse['data'][number]['status']) =>
  getPrintJobStatusTone(status);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Printing</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">列印中心</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            先看最新列印紀錄、失敗任務與重試狀態；Worker 管理放在第二層頁面。
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner v-if="isRefreshing" />
            <span>{{ resultSummary }}</span>
          </div>
          <Button type="button" variant="outline" class="w-full sm:w-auto" @click="navigateToWorkers">
            Print Worker 管理
          </Button>
        </div>
      </div>
    </div>

    <Alert v-if="hasBlockingError" variant="destructive">
      <AlertTitle>列印任務載入失敗</AlertTitle>
      <AlertDescription class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ apiError?.error.message ?? '目前無法取得列印任務列表。' }}</span>
        <Button type="button" variant="outline" @click="refreshPrintJobs({ force: true })">重試</Button>
      </AlertDescription>
    </Alert>

    <Card>
      <CardHeader class="gap-3">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>查詢與篩選</CardTitle>
            <CardDescription>
              依工單號片段與狀態篩選最近任務，失敗任務可直接 retry。
            </CardDescription>
          </div>
          <Button size="sm" type="button" variant="ghost" @click="clearFilters">清除篩選</Button>
        </div>
      </CardHeader>

      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="applyFilters">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
            <Field>
              <FieldLabel for="print-job-paper-order-no">工單號</FieldLabel>
              <Input
                id="print-job-paper-order-no"
                v-model="filterForm.paperOrderNo"
                autocomplete="off"
                name="paperOrderNo"
                placeholder="例如 BR-2026-0001"
              />
              <FieldError :errors="validationFieldErrors.paperOrderNo" />
            </Field>

            <Field>
              <FieldLabel for="print-job-status">狀態</FieldLabel>
              <Select :model-value="filterForm.status" @update:model-value="handleStatusChange">
                <SelectTrigger id="print-job-status" class="w-full">
                  <SelectValue placeholder="全部狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="ALL_STATUS_OPTION">全部狀態</SelectItem>
                  <SelectItem
                    v-for="option in ADMIN_PRINT_JOB_STATUS_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError :errors="validationFieldErrors.status" />
            </Field>

            <div class="grid gap-2 self-end sm:grid-cols-2 xl:grid-cols-1">
              <Button type="submit" class="w-full">查詢</Button>
              <Button type="button" variant="outline" class="w-full" @click="clearFilters">
                清除篩選
              </Button>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel for="print-job-sort">排序</FieldLabel>
              <Select :model-value="listQuery.sort" @update:model-value="handleSortChange">
                <SelectTrigger id="print-job-sort" class="w-full">
                  <SelectValue placeholder="選擇排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in ADMIN_PRINT_JOB_SORT_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel for="print-job-page-size">每頁筆數</FieldLabel>
              <Select
                :model-value="String(listQuery.pageSize)"
                @update:model-value="handlePageSizeChange"
              >
                <SelectTrigger id="print-job-page-size" class="w-full">
                  <SelectValue placeholder="選擇每頁筆數" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="pageSize in ADMIN_PRINT_LIST_PAGE_SIZE_OPTIONS"
                    :key="pageSize"
                    :value="String(pageSize)"
                  >
                    每頁 {{ pageSize }} 筆
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="gap-2">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>列印紀錄</CardTitle>
            <CardDescription>
              左側燈號用來快速區分成功、失敗、處理中與待列印。
            </CardDescription>
          </div>
          <p class="text-sm text-muted-foreground">{{ pageSummary }}</p>
        </div>
      </CardHeader>

      <CardContent class="space-y-4">
        <div v-if="isInitialLoading" class="space-y-3">
          <Skeleton v-for="index in 6" :key="`print-job-skeleton-${index}`" class="h-20 w-full" />
        </div>

        <Alert v-else-if="hasValidationErrorWithoutData" variant="destructive">
          <AlertTitle>查詢條件無效</AlertTitle>
          <AlertDescription>
            {{ apiError?.error.message ?? '請修正篩選條件後再試。' }}
          </AlertDescription>
        </Alert>

        <Alert v-else-if="isFilteredEmpty" variant="default">
          <AlertTitle>找不到符合條件的列印任務</AlertTitle>
          <AlertDescription>目前篩選條件下沒有可顯示的任務。</AlertDescription>
        </Alert>

        <Alert v-else-if="isEmpty" variant="default">
          <AlertTitle>尚未建立列印任務</AlertTitle>
          <AlertDescription>建工單成功後建立的 print job 會顯示在這裡。</AlertDescription>
        </Alert>

        <template v-else>
          <div class="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12">燈號</TableHead>
                  <TableHead>工單</TableHead>
                  <TableHead>任務</TableHead>
                  <TableHead>裝置</TableHead>
                  <TableHead>嘗試次數</TableHead>
                  <TableHead>最近錯誤</TableHead>
                  <TableHead>建立 / 更新</TableHead>
                  <TableHead class="w-28 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in response.data" :key="item.id" class="align-top">
                  <TableCell>
                    <PrintStatusLight :tone="getPrintJobLightTone(item.status)" />
                  </TableCell>
                  <TableCell>
                    <div class="space-y-2">
                      <NuxtLink
                        :to="getAdminWorkOrderDetailPath(item.workOrder.id)"
                        class="font-medium text-foreground hover:underline"
                      >
                        {{ item.workOrder.paperOrderNo }}
                      </NuxtLink>
                      <div class="space-y-1 text-sm text-muted-foreground">
                        <p>{{ item.customer.name ?? '未命名顧客' }}</p>
                        <p>{{ getBoardSummary(item) }}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-2">
                      <PrintJobStatusBadge :status="item.status" />
                      <div class="space-y-1 text-sm text-muted-foreground">
                        <p>{{ getPrintJobTypeLabel(item.jobType) }}</p>
                        <p v-if="item.printedAt">完成：{{ formatAdminDateTime(item.printedAt) }}</p>
                        <p v-else-if="item.lockedAt">鎖定：{{ formatAdminDateTime(item.lockedAt) }}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1 text-sm">
                      <p class="font-medium text-foreground">{{ item.device?.name ?? '未指派' }}</p>
                      <p class="text-muted-foreground">{{ item.lockedBy ?? '—' }}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1 text-sm">
                      <p class="font-medium text-foreground">{{ item.attemptCount }} / {{ item.maxAttempts }}</p>
                      <p class="text-muted-foreground">失敗後可重新排入 pending</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p class="max-w-xs text-sm leading-6 text-muted-foreground">
                      {{ item.lastError ?? '—' }}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1 text-sm text-muted-foreground">
                      <p>建立：{{ formatAdminDateTime(item.createdAt) }}</p>
                      <p>更新：{{ formatAdminDateTime(item.updatedAt) }}</p>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      :disabled="item.status !== 'failed' || isRetrying(item.id)"
                      @click="handleRetry(item.id)"
                    >
                      <Spinner v-if="isRetrying(item.id)" class="mr-2" />
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div class="grid gap-3 xl:hidden">
            <Card
              v-for="item in response.data"
              :key="item.id"
              data-size="sm"
              class="border-dashed"
            >
              <CardHeader class="gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <PrintStatusLight :tone="getPrintJobLightTone(item.status)" />
                    <div class="space-y-1">
                      <NuxtLink
                        :to="getAdminWorkOrderDetailPath(item.workOrder.id)"
                        class="font-medium text-foreground hover:underline"
                      >
                        {{ item.workOrder.paperOrderNo }}
                      </NuxtLink>
                      <p class="text-sm text-muted-foreground">{{ item.customer.name ?? '未命名顧客' }}</p>
                    </div>
                  </div>
                  <PrintJobStatusBadge :status="item.status" />
                </div>
              </CardHeader>
              <CardContent class="space-y-3 text-sm">
                <div class="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p class="text-muted-foreground">板型 / 任務</p>
                    <p class="mt-1 font-medium">{{ getBoardSummary(item) }}</p>
                    <p class="text-muted-foreground">{{ getPrintJobTypeLabel(item.jobType) }}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">裝置 / 嘗試次數</p>
                    <p class="mt-1 font-medium">{{ item.device?.name ?? '未指派' }}</p>
                    <p class="text-muted-foreground">{{ item.attemptCount }} / {{ item.maxAttempts }}</p>
                  </div>
                </div>

                <div class="space-y-1">
                  <p class="text-muted-foreground">最近錯誤</p>
                  <p>{{ item.lastError ?? '—' }}</p>
                </div>

                <div class="space-y-1 text-muted-foreground">
                  <p>建立：{{ formatAdminDateTime(item.createdAt) }}</p>
                  <p>更新：{{ formatAdminDateTime(item.updatedAt) }}</p>
                </div>

                <div class="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="item.status !== 'failed' || isRetrying(item.id)"
                    @click="handleRetry(item.id)"
                  >
                    <Spinner v-if="isRetrying(item.id)" class="mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </template>

        <div
          v-if="response.pageInfo.totalPages > 1"
          class="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-muted-foreground">{{ pageSummary }}</p>
          <Pagination :items-per-page="response.pageInfo.pageSize" :total="response.pageInfo.total">
            <PaginationContent>
              <PaginationPrevious
                href="#"
                :disabled="!response.pageInfo.hasPreviousPage"
                @click.prevent="goToPage(response.pageInfo.page - 1)"
              />

              <PaginationLink
                v-for="pageNumber in visiblePages"
                :key="pageNumber"
                href="#"
                :is-active="pageNumber === response.pageInfo.page"
                @click.prevent="goToPage(pageNumber)"
              >
                {{ pageNumber }}
              </PaginationLink>

              <PaginationNext
                href="#"
                :disabled="!response.pageInfo.hasNextPage"
                @click.prevent="goToPage(response.pageInfo.page + 1)"
              />
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
