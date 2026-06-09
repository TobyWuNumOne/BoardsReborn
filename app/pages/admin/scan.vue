<script setup lang="ts">
import { ExternalLinkIcon, RefreshCwIcon, SearchIcon, XIcon } from 'lucide-vue-next';
import { nextTick } from 'vue';
import { toast } from 'vue-sonner';
import type {
  AdminWorkOrderScanLookupData,
  AdminWorkOrderScanLookupResponse,
  AdminWorkOrderScanQuickNoteResponse,
} from '~/utils/admin-work-orders';
import {
  extractApiErrorEnvelope,
  formatAdminDate,
  formatAdminDateTime,
  getAdminWorkOrderScanActionLabel,
  getApiErrorStatusCode,
  getBoardLengthClassLabel,
  getBoardTypeLabel,
  getWorkOrderStatusLabel,
} from '~/utils/admin-work-orders';
import { getAdminRouteGuardRedirect } from '~/utils/admin-session';
import WorkOrderStatusBadge from '~/components/work-orders/WorkOrderStatusBadge.vue';
import { Textarea } from '~/components/ui/textarea';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;
type LookupState = 'idle' | 'loading' | 'not-found' | 'ready';

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: '掃碼查詢 | BoardsReborn',
});

const route = useRoute();
const adminSession = useAdminSession();
const scanCode = ref('');
const scanInputRef = ref<{ focus: () => void; select: () => void } | null>(null);
const lookupState = ref<LookupState>('idle');
const lookupErrorMessage = ref<string | null>(null);
const lookupResult = ref<AdminWorkOrderScanLookupData | null>(null);
const lastLookupCode = ref('');
const lookupStatusMessage = ref('請掃描或輸入工單號');
const isMutating = ref(false);
const noteDialogOpen = ref(false);
const unpaidDeliveryDialogOpen = ref(false);
const quickNote = ref('');
const quickNoteError = ref<string | null>(null);

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const selectedCode = computed(() => scanCode.value.trim());
const canSearch = computed(() => selectedCode.value.length > 0 && !isMutating.value);
const canOpenDetail = computed(() => Boolean(lookupResult.value?.summary.id));
const currentActions = computed(() => lookupResult.value?.availableActions ?? []);
const statusTransitionActions = computed(
  () => lookupResult.value?.availableStatusTransitions ?? [],
);
const showLookupResult = computed(() => lookupState.value === 'ready' && lookupResult.value);
const showNotFoundState = computed(() => lookupState.value === 'not-found');
const currentWorkOrderId = computed(() => lookupResult.value?.summary.id ?? '');
const isReadyForPickup = computed(() => lookupResult.value?.summary.status === 'READY_FOR_PICKUP');
const isUnpaid = computed(() => lookupResult.value?.summary.paymentReceived === false);

const focusAndSelectInput = async () => {
  await nextTick();
  scanInputRef.value?.focus();
  scanInputRef.value?.select();
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

const lookupWorkOrder = async (code = selectedCode.value) => {
  if (!code) {
    lookupErrorMessage.value = '請先掃描或輸入工單號。';
    lookupStatusMessage.value = '請掃描或輸入工單號';
    await focusAndSelectInput();
    return;
  }

  lookupState.value = 'loading';
  lookupErrorMessage.value = null;
  lookupStatusMessage.value = '查詢中...';

  try {
    const response = await getRequestFetch()<AdminWorkOrderScanLookupResponse>(
      '/api/admin/work-orders/lookup',
      {
        query: {
          code,
        },
      },
    );

    lookupResult.value = response.data;
    lookupState.value = 'ready';
    lookupStatusMessage.value = `已顯示 ${response.data.summary.paperOrderNo} 工單`;
    lastLookupCode.value = code;
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    const statusCode = getApiErrorStatusCode(error);
    const envelope = extractApiErrorEnvelope(error);

    if (statusCode === 404) {
      lookupState.value = 'not-found';
      lookupResult.value = null;
      lookupStatusMessage.value = '查無此工單';
      lookupErrorMessage.value = '請確認條碼是否正確，或改用工單列表搜尋。';
    } else {
      lookupState.value = 'idle';
      lookupStatusMessage.value = '目前無法查詢工單';
      lookupErrorMessage.value = envelope?.error.message ?? '目前無法查詢工單，請稍後再試。';
    }
  } finally {
    await focusAndSelectInput();
  }
};

const refreshLookupResult = async () => {
  if (!lastLookupCode.value) {
    return;
  }

  await lookupWorkOrder(lastLookupCode.value);
};

const handleSearch = async () => {
  await lookupWorkOrder();
};

const clearSearch = async () => {
  scanCode.value = '';
  lookupResult.value = null;
  lookupState.value = 'idle';
  lookupErrorMessage.value = null;
  lookupStatusMessage.value = '請掃描或輸入工單號';
  lastLookupCode.value = '';
  await focusAndSelectInput();
};

const openDetail = async () => {
  if (!currentWorkOrderId.value) {
    return;
  }

  await navigateTo(`/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}`);
};

const runMutation = async (action: () => Promise<void>, failureMessage: string) => {
  isMutating.value = true;

  try {
    await action();
    await refreshLookupResult();
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    const envelope = extractApiErrorEnvelope(error);
    toast.error(failureMessage, {
      description: envelope?.error.message ?? '請稍後再試。',
    });
  } finally {
    isMutating.value = false;
    await focusAndSelectInput();
  }
};

const markPaid = async () => {
  if (!currentWorkOrderId.value) {
    return;
  }

  await runMutation(async () => {
    await getRequestFetch()<unknown>(
      `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}`,
      {
        body: {
          paymentReceived: true,
        },
        method: 'PATCH',
      },
    );

    toast.success('已標記為已付款。');
  }, '標記付款失敗。');
};

const updateStatus = async (status: AdminWorkOrderScanLookupData['summary']['status']) => {
  if (!currentWorkOrderId.value) {
    return;
  }

  await runMutation(async () => {
    await getRequestFetch()<unknown>(
      `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}/status`,
      {
        body: {
          note: null,
          status,
        },
        method: 'POST',
      },
    );

    toast.success(`已更新為${getWorkOrderStatusLabel(status)}。`);
  }, '更新狀態失敗。');
};

const deliverWorkOrder = async () => {
  if (!currentWorkOrderId.value) {
    return;
  }

  unpaidDeliveryDialogOpen.value = false;

  await runMutation(async () => {
    await getRequestFetch()<unknown>(
      `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}/status`,
      {
        body: {
          note: null,
          status: 'DELIVERED',
        },
        method: 'POST',
      },
    );

    toast.success('已標記為已交件。');
  }, '標記交件失敗。');
};

const handleMarkDelivered = async () => {
  if (isUnpaid.value) {
    unpaidDeliveryDialogOpen.value = true;
    return;
  }

  await deliverWorkOrder();
};

const handleMarkPaidAndDelivered = async () => {
  if (!currentWorkOrderId.value) {
    return;
  }

  unpaidDeliveryDialogOpen.value = false;
  isMutating.value = true;

  try {
    await getRequestFetch()<unknown>(
      `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}`,
      {
        body: {
          paymentReceived: true,
        },
        method: 'PATCH',
      },
    );

    try {
      await getRequestFetch()<unknown>(
        `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}/status`,
        {
          body: {
            note: null,
            status: 'DELIVERED',
          },
          method: 'POST',
        },
      );

      toast.success('已完成付款並標記交件。');
    } catch (error) {
      const envelope = extractApiErrorEnvelope(error);
      toast.error('已標記付款，但交件失敗。', {
        description: envelope?.error.message ?? '工單仍維持未交件，請稍後再試。',
      });
    }

    await refreshLookupResult();
  } catch (error) {
    if (await handleAuthRedirect(error)) {
      return;
    }

    const envelope = extractApiErrorEnvelope(error);
    toast.error('標記付款失敗。', {
      description: envelope?.error.message ?? '請稍後再試。',
    });
  } finally {
    isMutating.value = false;
    await focusAndSelectInput();
  }
};

const submitQuickNote = async () => {
  if (!currentWorkOrderId.value) {
    return;
  }

  const note = quickNote.value.trim();

  if (!note) {
    quickNoteError.value = '請輸入備註內容。';
    return;
  }

  quickNoteError.value = null;
  noteDialogOpen.value = false;

  await runMutation(async () => {
    await getRequestFetch()<AdminWorkOrderScanQuickNoteResponse>(
      `/api/admin/work-orders/${encodeURIComponent(currentWorkOrderId.value)}/quick-note`,
      {
        body: {
          note,
        },
        method: 'POST',
      },
    );

    quickNote.value = '';
    toast.success('已新增備註。');
  }, '新增備註失敗。');
};

watch(noteDialogOpen, (open) => {
  if (open) {
    quickNoteError.value = null;
    return;
  }

  quickNote.value = '';
  quickNoteError.value = null;
});

onMounted(async () => {
  await focusAndSelectInput();
});
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-3">
      <Badge variant="secondary" class="w-fit">現場工具</Badge>
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold tracking-tight">掃碼查詢</h1>
        <p class="text-sm text-muted-foreground">
          掃描板上的條碼或輸入工單號後，直接查看單張工單並完成高頻現場操作。
        </p>
      </div>
    </section>

    <Card class="top-16 z-10 border-primary/15 bg-background/95 backdrop-blur">
      <CardContent class="space-y-4 p-4">
        <div class="flex flex-col gap-3 lg:flex-row">
          <div class="relative flex-1">
            <SearchIcon
              class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              ref="scanInputRef"
              v-model="scanCode"
              class="pl-9"
              placeholder="掃描或輸入工單號"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              @keydown.enter.prevent="handleSearch"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <Button type="button" :disabled="!canSearch" @click="handleSearch">
              <RefreshCwIcon v-if="lookupState === 'loading'" class="size-4 animate-spin" />
              <SearchIcon v-else class="size-4" />
              查詢
            </Button>
            <Button type="button" variant="outline" @click="clearSearch">
              <XIcon class="size-4" />
              清除
            </Button>
            <Button type="button" variant="outline" :disabled="!canOpenDetail" @click="openDetail">
              <ExternalLinkIcon class="size-4" />
              開啟完整工單
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTitle>{{ lookupStatusMessage }}</AlertTitle>
          <AlertDescription>
            <span v-if="lookupErrorMessage">{{ lookupErrorMessage }}</span>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>

    <Alert v-if="showNotFoundState" variant="destructive">
      <AlertTitle>查無此工單</AlertTitle>
      <AlertDescription> 請確認條碼是否正確，或改用工單列表搜尋。 </AlertDescription>
    </Alert>

    <template v-if="showLookupResult && lookupResult">
      <section class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>只顯示此狀態下允許的第一版高頻操作。</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Button
                v-if="currentActions.includes('mark_paid')"
                type="button"
                variant="outline"
                :disabled="isMutating || lookupResult.summary.paymentReceived"
                @click="markPaid"
              >
                {{ getAdminWorkOrderScanActionLabel('mark_paid') }}
              </Button>
              <Button
                v-if="currentActions.includes('mark_delivered')"
                type="button"
                :disabled="isMutating"
                @click="handleMarkDelivered"
              >
                {{ getAdminWorkOrderScanActionLabel('mark_delivered') }}
              </Button>
              <Button
                v-if="currentActions.includes('add_note')"
                type="button"
                variant="outline"
                :disabled="isMutating"
                @click="noteDialogOpen = true"
              >
                {{ getAdminWorkOrderScanActionLabel('add_note') }}
              </Button>
              <Button
                v-if="currentActions.includes('open_detail')"
                type="button"
                variant="outline"
                :disabled="isMutating"
                @click="openDetail"
              >
                {{ getAdminWorkOrderScanActionLabel('open_detail') }}
              </Button>
            </div>

            <div v-if="statusTransitionActions.length > 0" class="space-y-2">
              <p class="text-sm font-medium">更新狀態</p>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="status in statusTransitionActions"
                  :key="status"
                  type="button"
                  variant="default"
                  :disabled="isMutating"
                  @click="updateStatus(status)"
                >
                  {{ getWorkOrderStatusLabel(status) }}
                </Button>
              </div>
            </div>

            <Alert v-if="isReadyForPickup && isUnpaid" variant="destructive">
              <AlertTitle>交件前提醒</AlertTitle>
              <AlertDescription
                >此工單目前仍標示為未付款，交件前請再次確認現場收款狀態。</AlertDescription
              >
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="gap-3">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="space-y-1">
                <CardTitle class="text-xl">{{ lookupResult.summary.paperOrderNo }}</CardTitle>
                <CardDescription>
                  收件日 {{ formatAdminDate(lookupResult.summary.receivedAt) }} ・ 已停留
                  {{ lookupResult.summary.daysInShop ?? '—' }} 天
                </CardDescription>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <WorkOrderStatusBadge :status="lookupResult.summary.status" />
                <Badge :variant="lookupResult.summary.paymentReceived ? 'outline' : 'destructive'">
                  {{ lookupResult.summary.paymentReceived ? '已付款' : '未付款' }}
                </Badge>
                <Badge v-if="lookupResult.summary.isOverdue" variant="destructive">已逾期</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">預估完成日</p>
              <p class="text-sm font-medium">
                {{ formatAdminDate(lookupResult.summary.estimatedCompletedAt) }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">最近更新</p>
              <p class="text-sm font-medium">
                {{ formatAdminDateTime(lookupResult.summary.lastUpdatedAt) }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">顧客</p>
              <p class="text-sm font-medium">{{ lookupResult.customer.name || '—' }}</p>
              <p class="text-xs text-muted-foreground">{{ lookupResult.customer.phone || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">板型</p>
              <p class="text-sm font-medium">{{ getBoardTypeLabel(lookupResult.board.type) }}</p>
              <p class="text-xs text-muted-foreground">
                {{ getBoardLengthClassLabel(lookupResult.board.boardLengthClass) }} ・
                {{ lookupResult.board.sizeLabel || '—' }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">品牌 / 顏色</p>
              <p class="text-sm font-medium">
                {{ lookupResult.board.brand || '—' }} / {{ lookupResult.board.color || '—' }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">報價總額</p>
              <p class="text-sm font-medium">
                {{
                  lookupResult.pricing.finalAmount === null
                    ? '—'
                    : `NT$ ${lookupResult.pricing.finalAmount}`
                }}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>基本資訊</CardTitle>
            <CardDescription>現場判斷交件、追蹤與維修處理最常看的資料。</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">板子序號 / 特徵</p>
              <p class="text-sm font-medium">{{ lookupResult.board.serialLabel || '—' }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">初始報價</p>
              <p class="text-sm font-medium">
                {{
                  lookupResult.pricing.initialQuoteAmount === null
                    ? '—'
                    : `NT$ ${lookupResult.pricing.initialQuoteAmount}`
                }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">追加 / 調整</p>
              <p class="text-sm font-medium">
                {{
                  lookupResult.pricing.additionalAmount === null
                    ? '—'
                    : `NT$ ${lookupResult.pricing.additionalAmount}`
                }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">受損描述</p>
              <p class="text-sm font-medium whitespace-pre-wrap">
                {{ lookupResult.board.damageDescription || '—' }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">公開備註</p>
              <p class="text-sm font-medium whitespace-pre-wrap">
                {{ lookupResult.notes.publicNote || '—' }}
              </p>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-muted-foreground">交件備註</p>
              <p class="text-sm font-medium whitespace-pre-wrap">
                {{ lookupResult.notes.pickupNote || '—' }}
              </p>
            </div>
            <div class="space-y-1 md:col-span-2">
              <p class="text-sm text-muted-foreground">內部備註</p>
              <p class="text-sm font-medium whitespace-pre-wrap">
                {{ lookupResult.notes.internalNote || '—' }}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近狀態紀錄</CardTitle>
            <CardDescription>顯示最近 3 筆狀態變更，方便現場交接與追蹤。</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              v-if="lookupResult.recentHistory.length === 0"
              class="text-sm text-muted-foreground"
            >
              目前沒有可顯示的狀態紀錄。
            </div>
            <ol v-else class="space-y-3">
              <li
                v-for="historyItem in lookupResult.recentHistory"
                :key="historyItem.id"
                class="rounded-lg border p-3"
              >
                <p class="text-sm font-medium">
                  {{ formatAdminDateTime(historyItem.changedAt) }}
                  <span class="text-muted-foreground">
                    {{
                      historyItem.fromStatus
                        ? `${getWorkOrderStatusLabel(historyItem.fromStatus)} → `
                        : ''
                    }}
                    {{ getWorkOrderStatusLabel(historyItem.toStatus) }}
                  </span>
                </p>
                <p class="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {{ historyItem.note || '—' }}
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </template>

    <Dialog :open="noteDialogOpen" @update:open="(open) => (noteDialogOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增內部備註</DialogTitle>
          <DialogDescription>會附加到目前工單的內部備註尾端，不會覆蓋原內容。</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <Textarea
            v-model="quickNote"
            rows="5"
            placeholder="輸入要補充的現場備註"
            :aria-invalid="Boolean(quickNoteError)"
          />
          <p v-if="quickNoteError" class="text-sm text-destructive">{{ quickNoteError }}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="noteDialogOpen = false">取消</Button>
          <Button type="button" :disabled="isMutating" @click="submitQuickNote">新增備註</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      :open="unpaidDeliveryDialogOpen"
      @update:open="(open) => (unpaidDeliveryDialogOpen = open)"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>此工單尚未標記付款，仍要交件嗎？</DialogTitle>
          <DialogDescription>
            可以先標記付款再交件，或直接標記交件；兩個動作會分開記錄。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" :disabled="isMutating" @click="handleMarkPaidAndDelivered">
            先標記付款並交件
          </Button>
          <Button type="button" variant="outline" :disabled="isMutating" @click="deliverWorkOrder">
            仍然交件
          </Button>
          <Button
            type="button"
            variant="ghost"
            :disabled="isMutating"
            @click="unpaidDeliveryDialogOpen = false"
          >
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
