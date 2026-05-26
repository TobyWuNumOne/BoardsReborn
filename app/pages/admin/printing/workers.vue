<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import {
  extractApiErrorEnvelope,
  formatAdminDateTime,
  getApiErrorStatusCode,
  getAdminWorkOrderDetailPath,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import type {
  AdminPrintDeviceListItem,
  AdminPrintDeviceListResponse,
  AdminPrintDeviceCreatePayload,
  AdminPrintDeviceStatusValue,
  AdminPrintDeviceUpdatePayload,
  PrintDeviceConnectionState,
} from '~/utils/admin-printing';
import {
  ADMIN_PRINT_DEVICE_STATUS_OPTIONS,
  createEmptyAdminPrintDeviceListResponse,
  getPrintDeviceConnectionState,
  getPrintDeviceConnectionStateTone,
} from '~/utils/admin-printing';
import PrintDeviceStatusBadge from '~/components/printing/PrintDeviceStatusBadge.vue';
import PrintStatusLight from '~/components/printing/PrintStatusLight.vue';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;
const WORKER_LIST_PAGE_SIZE = 100;
const WORKER_HEARTBEAT_STALE_AFTER_SECONDS = 30;

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth'],
});

useHead({
  title: 'Print Worker 管理 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const editForm = reactive<{
  location: string;
  name: string;
  status: AdminPrintDeviceStatusValue;
}>({
  location: '',
  name: '',
  status: 'active',
});
const createDialogOpen = ref(false);
const createForm = reactive<{
  deviceKey: string;
  location: string;
  name: string;
  status: AdminPrintDeviceStatusValue;
}>({
  deviceKey: '',
  location: '',
  name: '',
  status: 'active',
});
const editingDeviceId = ref<string | null>(null);
const createApiError = ref<ApiErrorEnvelope | null>(null);
const creatingDevice = ref(false);
const deletingDeviceIds = ref<string[]>([]);
const savingDeviceId = ref<string | null>(null);
const togglingDeviceIds = ref<string[]>([]);
const heartbeatReferenceTime = ref(new Date());
let refreshTimer: number | null = null;
const deviceStatusValues = new Set<AdminPrintDeviceStatusValue>(
  ADMIN_PRINT_DEVICE_STATUS_OPTIONS.map((option) => option.value),
);
const lastSuccessfulResponse = shallowRef<AdminPrintDeviceListResponse | null>(null);

const handleEditStatusChange = (value: unknown) => {
  if (typeof value === 'string' && deviceStatusValues.has(value as AdminPrintDeviceStatusValue)) {
    editForm.status = value as AdminPrintDeviceStatusValue;
  }
};

const handleCreateStatusChange = (value: unknown) => {
  if (typeof value === 'string' && deviceStatusValues.has(value as AdminPrintDeviceStatusValue)) {
    createForm.status = value as AdminPrintDeviceStatusValue;
  }
};

const fetchPrintDevices = async () => {
  try {
    return await getRequestFetch()<AdminPrintDeviceListResponse>('/api/admin/print-devices', {
      query: {
        page: 1,
        pageSize: WORKER_LIST_PAGE_SIZE,
        sort: 'updatedAt:desc',
      },
    });
  } catch (error) {
    const statusCode = getApiErrorStatusCode(error);

    if (statusCode === 401 || statusCode === 403) {
      const sessionSnapshot = await adminSession.refreshAdminSession({ force: true });
      const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, route.fullPath);

      if (redirectTarget) {
        await navigateTo(redirectTarget);
      }

      return lastSuccessfulResponse.value ?? createEmptyAdminPrintDeviceListResponse(1, WORKER_LIST_PAGE_SIZE);
    }

    throw error;
  }
};

const {
  data,
  error,
  refresh,
  status: fetchStatus,
} = await useAsyncData('admin-print-devices', fetchPrintDevices);

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
  () =>
    data.value ??
    lastSuccessfulResponse.value ??
    createEmptyAdminPrintDeviceListResponse(1, WORKER_LIST_PAGE_SIZE),
);

const apiError = computed<ApiErrorEnvelope | null>(() => extractApiErrorEnvelope(error.value));
const createFieldErrors = computed<Record<string, string[]>>(
  () => createApiError.value?.error.fieldErrors ?? {},
);
const isInitialLoading = computed(
  () => fetchStatus.value === 'pending' && !lastSuccessfulResponse.value,
);
const isRefreshing = computed(
  () => fetchStatus.value === 'pending' && Boolean(lastSuccessfulResponse.value),
);
const hasBlockingError = computed(
  () => fetchStatus.value === 'error' && !lastSuccessfulResponse.value,
);
const hasDevices = computed(() => response.value.data.length > 0);
const isEmpty = computed(
  () =>
    !hasDevices.value &&
    !hasBlockingError.value,
);
const resultSummary = computed(() => `共 ${response.value.pageInfo.total} 台 worker`);
const canDeleteDevice = (item: AdminPrintDeviceListItem) => !item.currentJob;
const getDeviceConnectionState = (
  item: AdminPrintDeviceListItem,
): PrintDeviceConnectionState =>
  getPrintDeviceConnectionState({
    lastSeenAt: item.lastSeenAt,
    now: heartbeatReferenceTime.value,
    staleAfterSeconds: WORKER_HEARTBEAT_STALE_AFTER_SECONDS,
    status: item.status,
  });

const startEditingDevice = (item: AdminPrintDeviceListItem) => {
  editingDeviceId.value = item.id;
  editForm.name = item.name;
  editForm.location = item.location ?? '';
  editForm.status = item.status;
};

const cancelEditing = () => {
  editingDeviceId.value = null;
  editForm.name = '';
  editForm.location = '';
  editForm.status = 'active';
};

const resetCreateForm = () => {
  createForm.deviceKey = '';
  createForm.location = '';
  createForm.name = '';
  createForm.status = 'active';
  createApiError.value = null;
};

const handleCreateDialogOpenChange = (open: boolean) => {
  createDialogOpen.value = open;

  if (!open && !creatingDevice.value) {
    resetCreateForm();
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

const refreshWorkers = async ({ force = false }: { force?: boolean } = {}) => {
  heartbeatReferenceTime.value = new Date();

  if (!force && fetchStatus.value === 'pending') {
    return;
  }

  await refresh();
};

const patchPrintDevice = async (id: string, payload: AdminPrintDeviceUpdatePayload) => {
  return await getRequestFetch()<{
    data: AdminPrintDeviceListItem;
  }>(`/api/admin/print-devices/${id}`, {
    body: payload,
    method: 'PATCH',
  });
};

const createPrintDevice = async (payload: AdminPrintDeviceCreatePayload) => {
  return await getRequestFetch()<{
    data: AdminPrintDeviceListItem;
  }>('/api/admin/print-devices', {
    body: payload,
    method: 'POST',
  });
};

const deletePrintDevice = async (id: string) => {
  return await getRequestFetch()<{
    data: {
      id: string;
    };
  }>(`/api/admin/print-devices/${id}`, {
    method: 'DELETE',
  });
};

const saveNewDevice = async () => {
  creatingDevice.value = true;
  createApiError.value = null;

  try {
    await createPrintDevice({
      deviceKey: createForm.deviceKey.trim(),
      location: createForm.location.trim() || null,
      name: createForm.name.trim(),
      status: createForm.status,
    });
    toast.success('Print Worker 已新增。');
    createDialogOpen.value = false;
    resetCreateForm();
    await refreshWorkers({ force: true });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    createApiError.value = extractApiErrorEnvelope(error);
    toast.error('新增 Print Worker 失敗。', {
      description: createApiError.value?.error.message ?? '請稍後再試一次。',
    });
  } finally {
    creatingDevice.value = false;
  }
};

const saveEditingDevice = async () => {
  if (!editingDeviceId.value) {
    return;
  }

  savingDeviceId.value = editingDeviceId.value;

  try {
    await patchPrintDevice(editingDeviceId.value, {
      location: editForm.location.trim() || null,
      name: editForm.name.trim(),
      status: editForm.status,
    });
    toast.success('Print Worker 已更新。');
    cancelEditing();
    await refreshWorkers({ force: true });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    toast.error('更新 Print Worker 失敗。', {
      description: extractApiErrorEnvelope(error)?.error.message ?? '請稍後再試一次。',
    });
  } finally {
    savingDeviceId.value = null;
  }
};

const toggleDeviceStatus = async (item: AdminPrintDeviceListItem) => {
  if (togglingDeviceIds.value.includes(item.id)) {
    return;
  }

  togglingDeviceIds.value = [...togglingDeviceIds.value, item.id];
  const nextStatus = item.status === 'active' ? 'inactive' : 'active';

  try {
    await patchPrintDevice(item.id, {
      status: nextStatus,
    });
    toast.success(nextStatus === 'active' ? 'Worker 已啟用。' : 'Worker 已停用。');
    if (editingDeviceId.value === item.id) {
      editForm.status = nextStatus;
    }
    await refreshWorkers({ force: true });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    toast.error('更新 Worker 狀態失敗。', {
      description: extractApiErrorEnvelope(error)?.error.message ?? '請稍後再試一次。',
    });
  } finally {
    togglingDeviceIds.value = togglingDeviceIds.value.filter((deviceId) => deviceId !== item.id);
  }
};

const handleDeleteDevice = async (item: AdminPrintDeviceListItem) => {
  if (deletingDeviceIds.value.includes(item.id) || !canDeleteDevice(item)) {
    return;
  }

  if (!window.confirm(`確定要刪除 Worker「${item.name}」嗎？`)) {
    return;
  }

  deletingDeviceIds.value = [...deletingDeviceIds.value, item.id];

  try {
    await deletePrintDevice(item.id);

    if (editingDeviceId.value === item.id) {
      cancelEditing();
    }

    toast.success('Print Worker 已刪除。');
    await refreshWorkers({ force: true });
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    toast.error('刪除 Print Worker 失敗。', {
      description: extractApiErrorEnvelope(error)?.error.message ?? '請稍後再試一次。',
    });
  } finally {
    deletingDeviceIds.value = deletingDeviceIds.value.filter((deviceId) => deviceId !== item.id);
  }
};

const isToggling = (id: string) => togglingDeviceIds.value.includes(id);
const isDeleting = (id: string) => deletingDeviceIds.value.includes(id);
const getDeviceTone = (item: AdminPrintDeviceListItem) =>
  getPrintDeviceConnectionStateTone(getDeviceConnectionState(item));

onMounted(() => {
  heartbeatReferenceTime.value = new Date();
  refreshTimer = window.setInterval(() => {
    void refreshWorkers();
  }, 5000);
});

onBeforeUnmount(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Print workers</Badge>
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Print Worker 管理</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            以設備視角看 Raspberry Pi / local worker 的狀態、最後心跳與最近錯誤，並提供輕量編輯與啟停。
          </p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner v-if="isRefreshing" />
            <span>{{ resultSummary }}</span>
          </div>
          <Dialog :open="createDialogOpen" @update:open="handleCreateDialogOpenChange">
            <DialogTrigger as-child>
              <Button type="button" class="w-full sm:w-auto">新增 Worker</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增 Print Worker</DialogTitle>
                <DialogDescription>
                  建立後就不需要再去 Supabase Studio 手動新增裝置。
                </DialogDescription>
              </DialogHeader>

              <div class="grid gap-4">
                <Field>
                  <FieldLabel for="create-worker-name">名稱</FieldLabel>
                  <Input id="create-worker-name" v-model="createForm.name" autocomplete="off" />
                  <FieldError :errors="createFieldErrors.name" />
                </Field>

                <Field>
                  <FieldLabel for="create-worker-device-key">Device key</FieldLabel>
                  <Input
                    id="create-worker-device-key"
                    v-model="createForm.deviceKey"
                    autocomplete="off"
                    placeholder="例如 raspi-print-worker-01"
                  />
                  <FieldDescription>Pi 端需使用相同 `deviceKey` 呼叫 worker API。</FieldDescription>
                  <FieldError :errors="createFieldErrors.deviceKey" />
                </Field>

                <Field>
                  <FieldLabel for="create-worker-location">位置</FieldLabel>
                  <Input
                    id="create-worker-location"
                    v-model="createForm.location"
                    autocomplete="off"
                    placeholder="例如 Front Desk"
                  />
                  <FieldError :errors="createFieldErrors.location" />
                </Field>

                <Field>
                  <FieldLabel for="create-worker-status">狀態</FieldLabel>
                  <Select :model-value="createForm.status" @update:model-value="handleCreateStatusChange">
                    <SelectTrigger id="create-worker-status" class="w-full">
                      <SelectValue placeholder="選擇狀態" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in ADMIN_PRINT_DEVICE_STATUS_OPTIONS"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError :errors="createFieldErrors.status" />
                </Field>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" :disabled="creatingDevice" @click="handleCreateDialogOpenChange(false)">
                  取消
                </Button>
                <Button type="button" :disabled="creatingDevice" @click="saveNewDevice">
                  <Spinner v-if="creatingDevice" class="mr-2" />
                  建立 Worker
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    <Alert v-if="hasBlockingError" variant="destructive">
      <AlertTitle>Worker 列表載入失敗</AlertTitle>
      <AlertDescription class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ apiError?.error.message ?? '目前無法取得 worker 列表。' }}</span>
        <Button type="button" variant="outline" @click="refreshWorkers({ force: true })">重試</Button>
      </AlertDescription>
    </Alert>

    <Card v-if="editingDeviceId">
      <CardHeader>
        <CardTitle>編輯 Worker</CardTitle>
        <CardDescription>更新名稱、位置與狀態，不提供 token / device key 重設。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 lg:grid-cols-3">
          <Field>
            <FieldLabel for="worker-name">名稱</FieldLabel>
            <Input id="worker-name" v-model="editForm.name" autocomplete="off" />
          </Field>
          <Field>
            <FieldLabel for="worker-location">位置</FieldLabel>
            <Input id="worker-location" v-model="editForm.location" autocomplete="off" placeholder="例如 Front Desk" />
          </Field>
          <Field>
            <FieldLabel for="worker-status">狀態</FieldLabel>
            <Select :model-value="editForm.status" @update:model-value="handleEditStatusChange">
              <SelectTrigger id="worker-status" class="w-full">
                <SelectValue placeholder="選擇狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in ADMIN_PRINT_DEVICE_STATUS_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" @click="cancelEditing">取消</Button>
          <Button type="button" :disabled="savingDeviceId === editingDeviceId" @click="saveEditingDevice">
            <Spinner v-if="savingDeviceId === editingDeviceId" class="mr-2" />
            儲存變更
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="gap-2">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Worker 列表</CardTitle>
            <CardDescription>
              第一版直接顯示全部 Worker；左側燈號會綜合裝置狀態與最後心跳，只有最近 30 秒內回報的 `active`
              worker 才顯示為在線。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent class="space-y-4">
        <div v-if="isInitialLoading" class="space-y-3">
          <Skeleton v-for="index in 5" :key="`print-device-skeleton-${index}`" class="h-24 w-full" />
        </div>

        <Alert v-else-if="isEmpty" variant="default">
          <AlertTitle>尚未建立 Print Worker</AlertTitle>
          <AlertDescription>先在資料庫或 seed 中 provision 第一台 worker，這裡才會顯示。</AlertDescription>
        </Alert>

        <template v-else>
          <div class="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12">燈號</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>目前任務</TableHead>
                  <TableHead>最近錯誤</TableHead>
                  <TableHead>心跳 / 更新</TableHead>
                  <TableHead class="w-48 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in response.data" :key="item.id" class="align-top">
                  <TableCell>
                    <PrintStatusLight :tone="getDeviceTone(item)" />
                  </TableCell>
                  <TableCell>
                    <div class="space-y-2">
                      <div class="flex items-center gap-2">
                        <p class="font-medium text-foreground">{{ item.name }}</p>
                        <PrintDeviceStatusBadge :state="getDeviceConnectionState(item)" />
                      </div>
                      <div class="space-y-1 text-sm text-muted-foreground">
                        <p>{{ item.deviceKey }}</p>
                        <p>{{ item.location ?? '未設定位置' }}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1 text-sm">
                      <p v-if="item.currentJob?.workOrderId" class="font-medium text-foreground">
                        <NuxtLink
                          :to="getAdminWorkOrderDetailPath(item.currentJob.workOrderId)"
                          class="hover:underline"
                        >
                          {{ item.currentJob.paperOrderNo ?? '進行中任務' }}
                        </NuxtLink>
                      </p>
                      <p v-else class="font-medium text-foreground">—</p>
                      <p class="text-muted-foreground">
                        {{ item.currentJob?.lockedAt ? `鎖定：${formatAdminDateTime(item.currentJob.lockedAt)}` : '目前無鎖定任務' }}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="max-w-xs space-y-1 text-sm">
                      <p class="text-foreground">{{ item.recentError?.message ?? '—' }}</p>
                      <p class="text-muted-foreground">
                        {{ item.recentError?.updatedAt ? formatAdminDateTime(item.recentError.updatedAt) : '尚無錯誤紀錄' }}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div class="space-y-1 text-sm text-muted-foreground">
                      <p>最後心跳：{{ item.lastSeenAt ? formatAdminDateTime(item.lastSeenAt) : '從未回報' }}</p>
                      <p>更新：{{ formatAdminDateTime(item.updatedAt) }}</p>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" @click="startEditingDevice(item)">
                        編輯
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        :disabled="isToggling(item.id)"
                        @click="toggleDeviceStatus(item)"
                      >
                        <Spinner v-if="isToggling(item.id)" class="mr-2" />
                        {{ item.status === 'active' ? '停用' : '啟用' }}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        :disabled="!canDeleteDevice(item) || isDeleting(item.id)"
                        @click="handleDeleteDevice(item)"
                      >
                        <Spinner v-if="isDeleting(item.id)" class="mr-2" />
                        刪除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div class="grid gap-3 xl:hidden">
            <Card v-for="item in response.data" :key="item.id" data-size="sm" class="border-dashed">
              <CardHeader class="gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <PrintStatusLight :tone="getDeviceTone(item)" />
                    <div class="space-y-1">
                      <p class="font-medium text-foreground">{{ item.name }}</p>
                      <p class="text-sm text-muted-foreground">{{ item.location ?? '未設定位置' }}</p>
                    </div>
                  </div>
                  <PrintDeviceStatusBadge :state="getDeviceConnectionState(item)" />
                </div>
              </CardHeader>
              <CardContent class="space-y-3 text-sm">
                <div class="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p class="text-muted-foreground">Device key</p>
                    <p class="mt-1 break-all font-medium">{{ item.deviceKey }}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground">最後心跳</p>
                    <p class="mt-1 font-medium">
                      {{ item.lastSeenAt ? formatAdminDateTime(item.lastSeenAt) : '從未回報' }}
                    </p>
                  </div>
                </div>

                <div class="space-y-1">
                  <p class="text-muted-foreground">目前任務</p>
                  <p v-if="item.currentJob?.workOrderId" class="font-medium">
                    <NuxtLink
                      :to="getAdminWorkOrderDetailPath(item.currentJob.workOrderId)"
                      class="hover:underline"
                    >
                      {{ item.currentJob.paperOrderNo ?? '進行中任務' }}
                    </NuxtLink>
                  </p>
                  <p v-else>—</p>
                </div>

                <div class="space-y-1">
                  <p class="text-muted-foreground">最近錯誤</p>
                  <p>{{ item.recentError?.message ?? '—' }}</p>
                </div>

                <div class="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" @click="startEditingDevice(item)">
                    編輯
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="isToggling(item.id)"
                    @click="toggleDeviceStatus(item)"
                  >
                    <Spinner v-if="isToggling(item.id)" class="mr-2" />
                    {{ item.status === 'active' ? '停用' : '啟用' }}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    :disabled="!canDeleteDevice(item) || isDeleting(item.id)"
                    @click="handleDeleteDevice(item)"
                  >
                    <Spinner v-if="isDeleting(item.id)" class="mr-2" />
                    刪除
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
