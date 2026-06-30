<script setup lang="ts">
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  LinkIcon,
  PencilLineIcon,
  SearchIcon,
  UnlinkIcon,
} from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type {
  AdminCustomerApiErrorEnvelope,
  AdminCustomerDetailQueryState,
  AdminCustomerDetailResponse,
  AdminCustomerListItem,
  AdminCustomerListResponse,
} from '~/utils/admin-customers';
import {
  ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS,
  buildAdminCustomerDetailApiQuery,
  buildAdminCustomerListApiQuery,
  createEmptyAdminCustomerDetailResponse,
  createEmptyAdminCustomerListResponse,
  extractAdminCustomerApiErrorEnvelope,
  getAdjustedPageForCustomerPageInfo,
  getAdminCustomerApiErrorStatusCode,
  getAdminCustomerDetailAsyncKey,
  getCustomerLineStatusMeta,
  getVisibleCustomerPageNumbers,
  normalizeAdminCustomerDetailRouteQuery,
  serializeAdminCustomerDetailQuery,
} from '~/utils/admin-customers';
import {
  formatAdminDateTime,
  getAdminWorkOrderDetailPath,
  getWorkOrderStatusLabel,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

interface CustomerProfileFormState {
  name: string;
  note: string;
  phone: string;
}

interface CustomerDetailFetchPayload {
  requestKey: string;
  response: AdminCustomerDetailResponse;
}

interface TransferCandidateFetchPayload {
  requestKey: string;
  response: AdminCustomerListResponse;
}

const CUSTOMER_SEARCH_PAGE_SIZE = 8;

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth', 'admin-customer-detail-query'],
});

useHead({
  title: '顧客詳情 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const routeCustomerId = computed(() => {
  const rawValue = route.params.id;

  if (Array.isArray(rawValue)) {
    return rawValue[0] ?? '';
  }

  return typeof rawValue === 'string' ? rawValue : '';
});

const detailQuery = computed<AdminCustomerDetailQueryState>(
  () => normalizeAdminCustomerDetailRouteQuery(route.query).query,
);
const detailRequestKey = computed(() =>
  getAdminCustomerDetailAsyncKey(routeCustomerId.value, detailQuery.value),
);
const detailResponseFallback = computed(() =>
  createEmptyAdminCustomerDetailResponse(detailQuery.value.page, detailQuery.value.pageSize),
);

const profileForm = reactive<CustomerProfileFormState>({
  name: '',
  note: '',
  phone: '',
});
const isEditingProfile = ref(false);
const isSavingProfile = ref(false);
const profileFieldErrors = ref<Record<string, string[]>>({});
const profileApiError = ref<AdminCustomerApiErrorEnvelope | null>(null);

const lineActionError = ref<AdminCustomerApiErrorEnvelope | null>(null);
const issuedLiffUrl = ref('');
const issuedLiffExpiresAt = ref<string | null>(null);
const isIssuingLineBindToken = ref(false);
const isUnlinkingLineBinding = ref(false);
const unlinkDialogOpen = ref(false);

const transferDialogOpen = ref(false);
const transferWorkOrderId = ref<string | null>(null);
const transferWorkOrderPaperOrderNo = ref<string | null>(null);
const transferTargetSearch = ref('');
const transferTargetCustomerId = ref('');
const transferTargetCustomerLabel = ref('');
const isTransferringWorkOrder = ref(false);
const transferApiError = ref<AdminCustomerApiErrorEnvelope | null>(null);

const lastSuccessfulResponse = shallowRef<AdminCustomerDetailResponse | null>(null);
const lastSuccessfulDetailRequestKey = ref<string | null>(null);

const fetchCustomerDetail = async () => {
  const requestKey = detailRequestKey.value;

  try {
    const response = await getRequestFetch()<AdminCustomerDetailResponse>(
      `/api/admin/customers/${encodeURIComponent(routeCustomerId.value)}`,
      {
        query: buildAdminCustomerDetailApiQuery(detailQuery.value),
      },
    );

    return {
      requestKey,
      response,
    } satisfies CustomerDetailFetchPayload;
  } catch (error) {
    const statusCode = getAdminCustomerApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return {
        requestKey,
        response: lastSuccessfulResponse.value ?? detailResponseFallback.value,
      } satisfies CustomerDetailFetchPayload;
    }

    throw error;
  }
};

const {
  data: customerDetailResponse,
  error: customerDetailFetchError,
  refresh: refreshCustomerDetail,
  status: customerDetailFetchStatus,
} = await useAsyncData(detailRequestKey, fetchCustomerDetail, {
  watch: [detailRequestKey],
});

watch(
  customerDetailResponse,
  (payload) => {
    if (payload && payload.requestKey === detailRequestKey.value) {
      lastSuccessfulResponse.value = payload.response;
      lastSuccessfulDetailRequestKey.value = payload.requestKey;
    }
  },
  { immediate: true },
);

const customerData = computed(() =>
  lastSuccessfulResponse.value && lastSuccessfulDetailRequestKey.value === detailRequestKey.value
    ? lastSuccessfulResponse.value
    : detailResponseFallback.value,
);

const customerProfile = computed(() => customerData.value.data.customer);
const customerLine = computed(() => customerData.value.data.line);
const customerWorkOrders = computed(() => customerData.value.data.workOrders.data);
const customerWorkOrderPageInfo = computed(() => customerData.value.data.workOrders.pageInfo);
const customerLineMeta = computed(() =>
  getCustomerLineStatusMeta({
    linked: customerLine.value.status === 'bound',
    notifyStatus: customerLine.value.notificationStatus,
  }),
);
const isInitialLoading = computed(
  () =>
    customerDetailFetchStatus.value === 'pending' &&
    lastSuccessfulDetailRequestKey.value !== detailRequestKey.value,
);
const isRefreshing = computed(
  () =>
    customerDetailFetchStatus.value === 'pending' &&
    lastSuccessfulDetailRequestKey.value === detailRequestKey.value,
);
const apiErrorEnvelope = computed<AdminCustomerApiErrorEnvelope | null>(() =>
  extractAdminCustomerApiErrorEnvelope(customerDetailFetchError.value),
);
const hasInitialBlockingError = computed(
  () =>
    customerDetailFetchStatus.value === 'error' &&
    lastSuccessfulDetailRequestKey.value !== detailRequestKey.value,
);
const hasRefreshError = computed(
  () =>
    customerDetailFetchStatus.value === 'error' &&
    lastSuccessfulDetailRequestKey.value === detailRequestKey.value,
);
const visibleWorkOrderPages = computed(() =>
  getVisibleCustomerPageNumbers(
    customerWorkOrderPageInfo.value.page,
    customerWorkOrderPageInfo.value.totalPages,
  ),
);
const workOrderPageSummary = computed(() => {
  const { page, totalPages } = customerWorkOrderPageInfo.value;

  if (totalPages === 0) {
    return '第 1 / 0 頁';
  }

  return `第 ${page} / ${totalPages} 頁`;
});
const workOrderResultSummary = computed(() => `共 ${customerWorkOrderPageInfo.value.total} 筆工單`);
const hasWorkOrders = computed(() => customerWorkOrders.value.length > 0);
const isWorkOrdersEmpty = computed(() => !hasWorkOrders.value && !hasInitialBlockingError.value);
const selectedTransferTargetCustomer = computed(() =>
  transferTargetCustomerId.value
    ? (transferCandidateItems.value.find((item) => item.id === transferTargetCustomerId.value) ??
      null)
    : null,
);

const transferSearchRequestKey = computed(() =>
  JSON.stringify({
    page: 1,
    pageSize: CUSTOMER_SEARCH_PAGE_SIZE,
    q: transferTargetSearch.value.trim() || undefined,
    sort: 'updatedAt:desc',
    lineStatus: 'all',
  }),
);

const fetchTransferCandidates = async () => {
  const requestKey = transferSearchRequestKey.value;

  try {
    const response = await getRequestFetch()<AdminCustomerListResponse>('/api/admin/customers', {
      query: buildAdminCustomerListApiQuery({
        lineStatus: 'all',
        page: 1,
        pageSize: CUSTOMER_SEARCH_PAGE_SIZE,
        q: transferTargetSearch.value.trim() || undefined,
        sort: 'updatedAt:desc',
      }),
    });

    return {
      requestKey,
      response,
    } satisfies TransferCandidateFetchPayload;
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return {
        requestKey,
        response: createEmptyAdminCustomerListResponse(1, CUSTOMER_SEARCH_PAGE_SIZE),
      } satisfies TransferCandidateFetchPayload;
    }

    throw error;
  }
};

const {
  data: transferCandidateResponse,
  error: transferCandidateFetchError,
  refresh: refreshTransferCandidates,
  status: transferCandidateFetchStatus,
} = await useAsyncData(transferSearchRequestKey, fetchTransferCandidates, {
  watch: [transferSearchRequestKey],
});

const lastSuccessfulTransferRequestKey = ref<string | null>(null);
const transferCandidateApiError = computed<AdminCustomerApiErrorEnvelope | null>(() =>
  extractAdminCustomerApiErrorEnvelope(transferCandidateFetchError.value),
);
const transferCandidateItems = computed(() => {
  if (
    lastSuccessfulTransferRequestKey.value !== transferSearchRequestKey.value ||
    !transferCandidateResponse.value
  ) {
    return [];
  }

  return transferCandidateResponse.value.response.data.filter(
    (item) => item.id !== routeCustomerId.value,
  );
});
const transferCandidateLoading = computed(
  () =>
    transferCandidateFetchStatus.value === 'pending' &&
    lastSuccessfulTransferRequestKey.value !== transferSearchRequestKey.value,
);

watch(
  transferCandidateResponse,
  (payload) => {
    if (payload && payload.requestKey === transferSearchRequestKey.value) {
      lastSuccessfulTransferRequestKey.value = payload.requestKey;
    }
  },
  { immediate: true },
);

const updateCustomerDetailResponse = (nextPatch: Partial<AdminCustomerDetailResponse['data']>) => {
  const currentResponse = customerDetailResponse.value?.response ?? lastSuccessfulResponse.value;

  if (!currentResponse) {
    return;
  }

  const nextResponse: AdminCustomerDetailResponse = {
    data: {
      ...currentResponse.data,
      ...nextPatch,
    },
  };

  customerDetailResponse.value = {
    requestKey: detailRequestKey.value,
    response: nextResponse,
  };
  lastSuccessfulResponse.value = nextResponse;
  lastSuccessfulDetailRequestKey.value = detailRequestKey.value;
};

const syncProfileFormFromResponse = () => {
  profileForm.name = customerProfile.value.name;
  profileForm.note = customerProfile.value.note ?? '';
  profileForm.phone = customerProfile.value.phone;
  profileFieldErrors.value = {};
  profileApiError.value = null;
};

watch(
  customerProfile,
  () => {
    if (!isEditingProfile.value) {
      syncProfileFormFromResponse();
    }
  },
  { immediate: true },
);

watch(
  customerWorkOrderPageInfo,
  async (pageInfo) => {
    if (lastSuccessfulDetailRequestKey.value !== detailRequestKey.value) {
      return;
    }

    const adjustedPage = getAdjustedPageForCustomerPageInfo(detailQuery.value.page, pageInfo);

    if (!adjustedPage || adjustedPage === detailQuery.value.page) {
      return;
    }

    await navigateTo(
      {
        path: route.path,
        query: serializeAdminCustomerDetailQuery({
          page: adjustedPage,
          pageSize: detailQuery.value.pageSize,
        }),
      },
      { replace: true },
    );
  },
  { immediate: true },
);

async function handleAuthRedirect(error: unknown) {
  const statusCode = getAdminCustomerApiErrorStatusCode(error);

  if (statusCode !== 401 && statusCode !== 403) {
    return false;
  }

  const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
  const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

  if (redirectTarget) {
    await navigateTo(redirectTarget);
  }

  return true;
}

const cancelProfileEdit = () => {
  syncProfileFormFromResponse();
  isEditingProfile.value = false;
};

const startProfileEdit = () => {
  syncProfileFormFromResponse();
  isEditingProfile.value = true;
};

const saveProfile = async () => {
  if (isSavingProfile.value) {
    return;
  }

  isSavingProfile.value = true;
  profileApiError.value = null;
  profileFieldErrors.value = {};

  try {
    const response = await getRequestFetch()<AdminCustomerDetailResponse['data']['customer']>(
      `/api/admin/customers/${encodeURIComponent(routeCustomerId.value)}`,
      {
        body: {
          name: profileForm.name.trim(),
          note: profileForm.note.trim() ? profileForm.note.trim() : null,
          phone: profileForm.phone.trim(),
        },
        method: 'PATCH',
      },
    );

    updateCustomerDetailResponse({ customer: response });
    syncProfileFormFromResponse();
    isEditingProfile.value = false;
    toast.success('顧客資料已更新。');
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    profileApiError.value = extractAdminCustomerApiErrorEnvelope(error);
    profileFieldErrors.value = profileApiError.value?.error.fieldErrors ?? {};
    toast.error(profileApiError.value?.error.message || '更新顧客資料失敗。');
  } finally {
    isSavingProfile.value = false;
  }
};

const issueLineBindToken = async () => {
  if (isIssuingLineBindToken.value) {
    return;
  }

  isIssuingLineBindToken.value = true;
  lineActionError.value = null;

  try {
    const response = await getRequestFetch()<{
      data: { expiresAt: string; id: string; liffUrl: string; revokedTokenCount: number };
    }>(`/api/admin/customers/${encodeURIComponent(routeCustomerId.value)}/line-bind-token`, {
      body: {},
      method: 'POST',
    });

    issuedLiffUrl.value = response.data.liffUrl;
    issuedLiffExpiresAt.value = response.data.expiresAt;
    toast.success('LINE 綁定連結已產生。');
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    lineActionError.value = extractAdminCustomerApiErrorEnvelope(error);
    toast.error(lineActionError.value?.error.message || '產生 LINE 綁定連結失敗。');
  } finally {
    isIssuingLineBindToken.value = false;
  }
};

const copyIssuedLiffUrl = async () => {
  if (!issuedLiffUrl.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(issuedLiffUrl.value);
    toast.success('LINE 綁定連結已複製。');
  } catch {
    toast.error('複製 LINE 綁定連結失敗。');
  }
};

const applyUnboundLineState = () => {
  updateCustomerDetailResponse({
    line: {
      blockedAt: null,
      displayName: null,
      friendshipCheckedAt: null,
      isFriend: null,
      linkedAt: null,
      notificationStatus: 'not_notifyable',
      status: 'unbound',
    },
  });
};

const unlinkLineBinding = async () => {
  if (isUnlinkingLineBinding.value) {
    return;
  }

  isUnlinkingLineBinding.value = true;
  lineActionError.value = null;

  try {
    await getRequestFetch()<{ data: { customerId: string } }>(
      `/api/admin/customers/${encodeURIComponent(routeCustomerId.value)}/line-binding`,
      {
        method: 'DELETE',
      },
    );

    unlinkDialogOpen.value = false;
    issuedLiffUrl.value = '';
    issuedLiffExpiresAt.value = null;
    applyUnboundLineState();
    toast.success('LINE 綁定已解除。');
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    lineActionError.value = extractAdminCustomerApiErrorEnvelope(error);
    toast.error(lineActionError.value?.error.message || '解除 LINE 綁定失敗。');
  } finally {
    isUnlinkingLineBinding.value = false;
  }
};

const openTransferDialog = (
  workOrder: AdminCustomerDetailResponse['data']['workOrders']['data'][number],
) => {
  transferWorkOrderId.value = workOrder.id;
  transferWorkOrderPaperOrderNo.value = workOrder.paperOrderNo;
  transferTargetSearch.value = '';
  transferTargetCustomerId.value = '';
  transferTargetCustomerLabel.value = '';
  transferApiError.value = null;
  transferDialogOpen.value = true;
};

const closeTransferDialog = () => {
  transferDialogOpen.value = false;
  transferWorkOrderId.value = null;
  transferWorkOrderPaperOrderNo.value = null;
  transferTargetSearch.value = '';
  transferTargetCustomerId.value = '';
  transferTargetCustomerLabel.value = '';
  transferApiError.value = null;
};

const handleTransferDialogOpenChange = (open: boolean) => {
  transferDialogOpen.value = open;

  if (open) {
    void refreshTransferCandidates();
    return;
  }

  closeTransferDialog();
};

const selectTransferTargetCustomer = (item: AdminCustomerListItem) => {
  transferTargetCustomerId.value = item.id;
  transferTargetCustomerLabel.value = `${item.name} / ${item.phone}`;
  transferApiError.value = null;
};

const transferWorkOrder = async () => {
  if (
    !transferWorkOrderId.value ||
    !transferTargetCustomerId.value ||
    isTransferringWorkOrder.value
  ) {
    return;
  }

  isTransferringWorkOrder.value = true;
  transferApiError.value = null;

  try {
    await getRequestFetch()<{
      data: {
        previousCustomerId: string;
        targetCustomerId: string;
        transferredAt: string;
        workOrderId: string;
      };
    }>(
      `/api/admin/work-orders/${encodeURIComponent(transferWorkOrderId.value)}/transfer-customer`,
      {
        body: {
          targetCustomerId: transferTargetCustomerId.value,
        },
        method: 'POST',
      },
    );

    toast.success('工單已轉移。');
    closeTransferDialog();

    try {
      await refreshCustomerDetail();
    } catch (refreshError) {
      if (await handleAuthRedirect(refreshError)) {
        return;
      }

      toast.error('工單已轉移，但重新載入最新資料失敗。');
    }
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    transferApiError.value = extractAdminCustomerApiErrorEnvelope(error);
    toast.error(transferApiError.value?.error.message || '轉移工單失敗。');
  } finally {
    isTransferringWorkOrder.value = false;
  }
};

const goToWorkOrdersPage = async (page: number) => {
  if (page === detailQuery.value.page) {
    return;
  }

  await navigateTo(
    {
      path: route.path,
      query: serializeAdminCustomerDetailQuery({
        page,
        pageSize: detailQuery.value.pageSize,
      }),
    },
    { replace: false },
  );
};

const changePageSize = async (value: number) => {
  if (value === detailQuery.value.pageSize) {
    return;
  }

  await navigateTo(
    {
      path: route.path,
      query: serializeAdminCustomerDetailQuery({
        page: 1,
        pageSize: value,
      }),
    },
    { replace: false },
  );
};

const formatNullableText = (value: string | null | undefined) => value?.trim() || '—';

const formatNullableBoolean = (value: boolean | null | undefined) => {
  if (value === true) {
    return '是';
  }

  if (value === false) {
    return '否';
  }

  return '—';
};

const formatNotifyability = () => {
  if (customerLine.value.status === 'unbound') {
    return '—';
  }

  if (customerLine.value.notificationStatus === 'notifyable') {
    return '可通知';
  }

  if (customerLine.value.notificationStatus === 'not_notifyable') {
    return '不可通知';
  }

  return '未知';
};

const formatSelectedCustomerLabel = computed(
  () =>
    transferTargetCustomerLabel.value ||
    (selectedTransferTargetCustomer.value
      ? `${selectedTransferTargetCustomer.value.name} / ${selectedTransferTargetCustomer.value.phone}`
      : '尚未選擇'),
);

const profileIsDirty = computed(() => {
  const currentName = customerProfile.value.name.trim();
  const currentPhone = customerProfile.value.phone.trim();
  const currentNote = customerProfile.value.note ?? '';

  return (
    profileForm.name.trim() !== currentName ||
    profileForm.phone.trim() !== currentPhone ||
    profileForm.note.trim() !== currentNote
  );
});

watch(
  transferCandidateResponse,
  (payload) => {
    const selected = payload?.response.data.find(
      (item) => item.id === transferTargetCustomerId.value,
    );

    if (selected) {
      transferTargetCustomerLabel.value = `${selected.name} / ${selected.phone}`;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Customers</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">顧客詳情</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            檢視與編輯顧客 profile、LINE 綁定與名下工單。
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner v-if="isRefreshing" />
            <span>{{ workOrderResultSummary }}</span>
          </div>
          <Button as-child type="button" variant="outline">
            <NuxtLink to="/admin/customers">返回顧客列表</NuxtLink>
          </Button>
        </div>
      </div>
    </div>

    <Alert v-if="hasRefreshError" variant="destructive">
      <AlertTitle>顧客資料重新載入失敗</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
        <span>{{ apiErrorEnvelope?.error.message ?? '請稍後再試。' }}</span>
        <Button type="button" variant="outline" @click="refreshCustomerDetail">重新載入</Button>
      </AlertDescription>
    </Alert>

    <template v-if="isInitialLoading">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardContent class="space-y-4 p-6">
            <Skeleton class="h-6 w-40" />
            <Skeleton class="h-24 w-full" />
            <Skeleton class="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent class="space-y-4 p-6">
            <Skeleton class="h-6 w-40" />
            <Skeleton class="h-24 w-full" />
            <Skeleton class="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent class="space-y-4 p-6">
          <Skeleton class="h-6 w-44" />
          <Skeleton class="h-16 w-full" />
          <Skeleton v-for="index in 3" :key="index" class="h-20 w-full" />
        </CardContent>
      </Card>
    </template>

    <Card v-else-if="hasInitialBlockingError">
      <CardHeader>
        <CardTitle>顧客詳情載入失敗</CardTitle>
        <CardDescription>
          {{ apiErrorEnvelope?.error.message ?? '目前無法取得顧客資料，請稍後再試。' }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-3">
        <Button type="button" @click="refreshCustomerDetail">重新載入</Button>
        <Button as-child type="button" variant="outline">
          <NuxtLink to="/admin/customers">返回顧客列表</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <template v-else>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader class="gap-3">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <CardTitle>顧客 profile</CardTitle>
                <CardDescription>可在 read mode 與 edit mode 間切換。</CardDescription>
              </div>

              <div class="flex flex-wrap gap-2">
                <Button
                  v-if="isEditingProfile"
                  type="button"
                  variant="outline"
                  :disabled="isSavingProfile"
                  @click="cancelProfileEdit"
                >
                  取消
                </Button>
                <Button
                  v-if="isEditingProfile"
                  type="button"
                  :disabled="isSavingProfile || !profileIsDirty"
                  @click="saveProfile"
                >
                  <Spinner v-if="isSavingProfile" data-icon="inline-start" />
                  儲存
                </Button>
                <Button v-else type="button" variant="outline" @click="startProfileEdit">
                  <PencilLineIcon data-icon="inline-start" />
                  編輯
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent class="space-y-4">
            <Alert v-if="profileApiError" variant="destructive">
              <AlertTitle>儲存顧客資料失敗</AlertTitle>
              <AlertDescription class="space-y-1">
                <p>{{ profileApiError.error.message }}</p>
                <p v-if="profileApiError.error.requestId" class="text-xs text-destructive/80">
                  requestId: {{ profileApiError.error.requestId }}
                </p>
              </AlertDescription>
            </Alert>

            <template v-if="isEditingProfile">
              <div class="grid gap-4">
                <div class="space-y-2">
                  <FieldLabel for="customer-name">姓名</FieldLabel>
                  <Input
                    id="customer-name"
                    v-model="profileForm.name"
                    autocomplete="off"
                    :aria-invalid="Boolean(profileFieldErrors.name?.length)"
                  />
                  <FieldError :errors="profileFieldErrors.name" />
                </div>

                <div class="space-y-2">
                  <FieldLabel for="customer-phone">電話</FieldLabel>
                  <Input
                    id="customer-phone"
                    v-model="profileForm.phone"
                    autocomplete="off"
                    inputmode="tel"
                    :aria-invalid="Boolean(profileFieldErrors.phone?.length)"
                  />
                  <FieldError :errors="profileFieldErrors.phone" />
                </div>

                <div class="space-y-2">
                  <FieldLabel for="customer-note">備註</FieldLabel>
                  <Textarea
                    id="customer-note"
                    v-model="profileForm.note"
                    :aria-invalid="Boolean(profileFieldErrors.note?.length)"
                  />
                  <FieldError :errors="profileFieldErrors.note" />
                </div>
              </div>
            </template>

            <template v-else>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-1">
                  <p class="text-sm text-muted-foreground">姓名</p>
                  <p class="text-sm font-medium">{{ customerProfile.name || '—' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm text-muted-foreground">電話</p>
                  <p class="text-sm font-medium">{{ customerProfile.phone || '—' }}</p>
                </div>
                <div class="space-y-1 sm:col-span-2">
                  <p class="text-sm text-muted-foreground">備註</p>
                  <p class="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-6">
                    {{ formatNullableText(customerProfile.note) }}
                  </p>
                </div>
              </div>

              <div class="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div class="space-y-1">
                  <p class="text-sm text-muted-foreground">建立時間</p>
                  <p class="text-sm font-medium">
                    {{ formatAdminDateTime(customerProfile.createdAt) }}
                  </p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm text-muted-foreground">更新時間</p>
                  <p class="text-sm font-medium">
                    {{ formatAdminDateTime(customerProfile.updatedAt) }}
                  </p>
                </div>
              </div>
            </template>
          </CardContent>
        </Card>

        <Card class="gap-0 overflow-hidden py-0">
          <CardHeader
            class="border-b bg-[linear-gradient(120deg,rgba(6,199,85,0.18),rgba(6,199,85,0.08)_42%,transparent_72%)] py-6"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="space-y-1">
                <CardTitle>LINE 管理</CardTitle>
                <CardDescription>綁定、好友、封鎖與通知狀態分開顯示。</CardDescription>
              </div>
              <Badge variant="outline" :class="customerLineMeta.badgeClass">
                {{ customerLineMeta.label }}
              </Badge>
            </div>
          </CardHeader>

          <CardContent class="space-y-5 p-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">LINE 名稱</p>
                <p class="text-sm font-semibold">{{ customerLine.displayName || '—' }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">綁定狀態</p>
                <p class="text-sm font-semibold">{{ customerLineMeta.label }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">好友狀態</p>
                <p class="text-sm font-semibold">
                  {{ formatNullableBoolean(customerLine.isFriend) }}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">封鎖狀態</p>
                <p class="text-sm font-semibold">
                  {{
                    customerLine.blockedAt
                      ? '已封鎖'
                      : customerLine.status === 'bound'
                        ? '未封鎖'
                        : '—'
                  }}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">可通知</p>
                <p class="text-sm font-semibold">{{ formatNotifyability() }}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-medium tracking-wide text-muted-foreground">最後檢查時間</p>
                <p class="text-sm font-semibold">
                  {{ formatAdminDateTime(customerLine.friendshipCheckedAt) }}
                </p>
              </div>
            </div>

            <div
              v-if="customerLine.status === 'unbound'"
              class="space-y-3 rounded-xl border bg-muted/20 p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-sm font-medium">顧客尚未綁定 LINE</p>
                  <p class="text-sm text-muted-foreground">
                    發卡只會產生 LIFF 連結，不會自動建立列印任務。
                  </p>
                </div>
                <Button
                  type="button"
                  :disabled="isIssuingLineBindToken"
                  @click="issueLineBindToken"
                >
                  <Spinner v-if="isIssuingLineBindToken" data-icon="inline-start" />
                  <LinkIcon v-else data-icon="inline-start" />
                  產生 LINE 綁定連結
                </Button>
              </div>

              <div v-if="issuedLiffUrl" class="space-y-2 rounded-lg border bg-background p-3">
                <div class="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckIcon class="size-4" />
                  新連結已產生
                </div>
                <p class="break-all font-mono text-xs text-muted-foreground">{{ issuedLiffUrl }}</p>
                <div class="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" @click="copyIssuedLiffUrl">
                    <CopyIcon data-icon="inline-start" />
                    複製 LIFF URL
                  </Button>
                </div>
                <p v-if="issuedLiffExpiresAt" class="text-xs text-muted-foreground">
                  到期時間：{{ formatAdminDateTime(issuedLiffExpiresAt) }}
                </p>
              </div>
            </div>

            <div
              v-else
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4"
            >
              <p class="max-w-xl text-sm text-muted-foreground">
                解除後可阻止尚未送出的通知，但無法撤回已送到 LINE Platform 的 request。
              </p>
              <Button type="button" variant="destructive" @click="unlinkDialogOpen = true">
                <UnlinkIcon data-icon="inline-start" />
                解除綁定
              </Button>
            </div>

            <Alert v-if="lineActionError" variant="destructive">
              <AlertTitle>LINE 操作失敗</AlertTitle>
              <AlertDescription class="space-y-1">
                <p>{{ lineActionError.error.message }}</p>
                <p v-if="lineActionError.error.requestId" class="text-xs text-destructive/80">
                  requestId: {{ lineActionError.error.requestId }}
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader class="gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>工單</CardTitle>
            <CardDescription>顯示此顧客名下工單、最新更新時間與轉移入口。</CardDescription>
          </div>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner v-if="isRefreshing" />
            <span>{{ workOrderResultSummary }}</span>
          </div>
        </CardHeader>

        <CardContent class="space-y-4">
          <div
            v-if="isWorkOrdersEmpty"
            class="rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
          >
            這位顧客目前沒有工單。
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="workOrder in customerWorkOrders"
              :key="workOrder.id"
              class="rounded-xl border bg-background p-4"
            >
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-base font-semibold">{{ workOrder.paperOrderNo }}</p>
                    <Badge variant="outline">{{
                      getWorkOrderStatusLabel(workOrder.currentStatus)
                    }}</Badge>
                  </div>
                  <div
                    class="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <div class="space-y-1">
                      <p class="text-xs font-medium tracking-wide">最近更新</p>
                      <p class="text-sm font-medium text-foreground">
                        {{ formatAdminDateTime(workOrder.updatedAt) }}
                      </p>
                    </div>
                    <div class="space-y-1">
                      <p class="text-xs font-medium tracking-wide">最新導航</p>
                      <p class="text-sm font-medium text-foreground">
                        <NuxtLink
                          :to="getAdminWorkOrderDetailPath(workOrder.id)"
                          class="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                        >
                          查看工單詳情
                          <ArrowRightLeftIcon class="size-3.5" />
                        </NuxtLink>
                      </p>
                    </div>
                    <div class="space-y-1">
                      <p class="text-xs font-medium tracking-wide">工單 ID</p>
                      <p class="text-sm font-medium text-foreground">{{ workOrder.id }}</p>
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <Button as-child type="button" variant="outline" size="sm">
                    <NuxtLink :to="getAdminWorkOrderDetailPath(workOrder.id)">
                      查看工單詳情
                    </NuxtLink>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    @click="openTransferDialog(workOrder)"
                  >
                    轉移工單
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="customerWorkOrderPageInfo.totalPages > 0" class="space-y-3 border-t pt-4">
            <div
              class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
            >
              <span>{{ workOrderResultSummary }}</span>
              <span>{{ workOrderPageSummary }}</span>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2">
              <Button
                :disabled="!customerWorkOrderPageInfo.hasPreviousPage"
                type="button"
                variant="outline"
                @click="goToWorkOrdersPage(customerWorkOrderPageInfo.page - 1)"
              >
                <ChevronLeftIcon class="size-4" />
                上一頁
              </Button>

              <Button
                v-for="pageNumber in visibleWorkOrderPages"
                :key="pageNumber"
                :variant="pageNumber === customerWorkOrderPageInfo.page ? 'default' : 'outline'"
                type="button"
                @click="goToWorkOrdersPage(pageNumber)"
              >
                {{ pageNumber }}
              </Button>

              <Button
                :disabled="!customerWorkOrderPageInfo.hasNextPage"
                type="button"
                variant="outline"
                @click="goToWorkOrdersPage(customerWorkOrderPageInfo.page + 1)"
              >
                下一頁
                <ChevronRightIcon class="size-4" />
              </Button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <span>每頁筆數</span>
                <Select
                  :model-value="String(detailQuery.pageSize)"
                  @update:model-value="
                    (value) => typeof value === 'string' && changePageSize(Number(value))
                  "
                >
                  <SelectTrigger class="w-28">
                    <SelectValue placeholder="選擇" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in ADMIN_CUSTOMER_LIST_PAGE_SIZE_OPTIONS"
                      :key="option"
                      :value="String(option)"
                    >
                      {{ option }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
    <Dialog :open="unlinkDialogOpen" @update:open="(open) => (unlinkDialogOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>解除 LINE 綁定？</DialogTitle>
          <DialogDescription class="space-y-2">
            <span class="block">解除後顧客將不再收到 LINE 通知。</span>
            <span class="block">舊 QR 不會重新變成可綁定；若要重新綁定，需要重新發卡。</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isUnlinkingLineBinding"
            @click="unlinkDialogOpen = false"
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            :disabled="isUnlinkingLineBinding"
            @click="unlinkLineBinding"
          >
            <Spinner v-if="isUnlinkingLineBinding" data-icon="inline-start" />
            確認解除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="transferDialogOpen" @update:open="handleTransferDialogOpenChange">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>轉移工單</DialogTitle>
          <DialogDescription>
            將工單 {{ transferWorkOrderPaperOrderNo || '—' }} 轉移到其他既有顧客。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <FieldLabel for="transfer-target-search">搜尋目標顧客</FieldLabel>
            <div class="relative">
              <SearchIcon
                class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="transfer-target-search"
                v-model="transferTargetSearch"
                class="pl-9"
                autocomplete="off"
                placeholder="輸入姓名、電話或備註"
              />
            </div>
          </div>

          <Alert v-if="transferApiError" variant="destructive">
            <AlertTitle>轉移工單失敗</AlertTitle>
            <AlertDescription class="space-y-1">
              <p>{{ transferApiError.error.message }}</p>
              <p v-if="transferApiError.error.requestId" class="text-xs text-destructive/80">
                requestId: {{ transferApiError.error.requestId }}
              </p>
            </AlertDescription>
          </Alert>

          <Alert v-else-if="transferCandidateApiError" variant="destructive">
            <AlertTitle>顧客搜尋失敗</AlertTitle>
            <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
              <span>{{ transferCandidateApiError.error.message }}</span>
              <Button type="button" variant="outline" @click="refreshTransferCandidates"
                >重新載入</Button
              >
            </AlertDescription>
          </Alert>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">搜尋結果</p>
              <span class="text-xs text-muted-foreground">只顯示前 8 筆最近顧客</span>
            </div>

            <div v-if="transferCandidateLoading" class="space-y-2">
              <Skeleton class="h-16 w-full" />
              <Skeleton class="h-16 w-full" />
            </div>

            <div
              v-else-if="transferCandidateItems.length === 0"
              class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
            >
              找不到符合條件的顧客。
            </div>

            <div v-else class="grid gap-2">
              <button
                v-for="item in transferCandidateItems"
                :key="item.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/40"
                :class="
                  item.id === transferTargetCustomerId
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                "
                @click="selectTransferTargetCustomer(item)"
              >
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium">{{ item.name }}</p>
                    <Badge variant="outline">
                      {{
                        getCustomerLineStatusMeta({
                          linked: item.line.status === 'bound',
                          notifyStatus: item.line.notificationStatus,
                        }).label
                      }}
                    </Badge>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ item.phone }}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ item.note || '—' }}
                  </p>
                </div>
                <span class="text-xs text-muted-foreground">選取</span>
              </button>
            </div>
          </div>

          <div class="space-y-2 rounded-lg border bg-muted/20 p-4">
            <p class="text-sm font-medium">已選擇目標顧客</p>
            <p class="text-sm text-muted-foreground">{{ formatSelectedCustomerLabel }}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isTransferringWorkOrder"
            @click="closeTransferDialog"
          >
            取消
          </Button>
          <Button
            type="button"
            :disabled="!transferTargetCustomerId || isTransferringWorkOrder"
            @click="transferWorkOrder"
          >
            <Spinner v-if="isTransferringWorkOrder" data-icon="inline-start" />
            轉移工單
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
