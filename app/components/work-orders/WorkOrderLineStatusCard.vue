<script setup lang="ts">
import { CheckIcon, CopyIcon, LinkIcon, UnlinkIcon } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import type { ApiErrorEnvelope } from '~/utils/admin-work-orders';
import type { AdminWorkOrderLineStatusResponse } from '~/utils/admin-line';
import {
  getAdminLineBindingLabel,
  getAdminLineJobStatusLabel,
  getAdminLineJobTypeLabel,
  getAdminLineSkipReasonLabel,
  getAdminLineTokenStatusLabel,
} from '~/utils/admin-line';
import {
  extractApiErrorEnvelope,
  formatAdminDateTime,
  getApiErrorStatusCode,
} from '~/utils/admin-work-orders';

const props = defineProps<{ workOrderId: string }>();

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

const getRequestFetch = (): RequestFetch =>
  import.meta.server ? (useRequestFetch() as RequestFetch) : ($fetch as RequestFetch);

const issuedLiffUrl = ref('');
const actionError = ref<ApiErrorEnvelope | null>(null);
const isIssuing = ref(false);
const isUnlinking = ref(false);
const unlinkDialogOpen = ref(false);

const fetchLineStatus = () =>
  getRequestFetch()<AdminWorkOrderLineStatusResponse>(
    `/api/admin/work-orders/${encodeURIComponent(props.workOrderId)}/line-status`,
  );

const {
  data: lineStatusResponse,
  error: lineStatusError,
  refresh: refreshLineStatus,
  status: lineStatusFetchStatus,
} = await useAsyncData(
  computed(() => `admin-work-order-line-status:${props.workOrderId}`),
  fetchLineStatus,
  { watch: [() => props.workOrderId] },
);

const lineStatus = computed(() => lineStatusResponse.value?.data ?? null);
const isLoading = computed(
  () => lineStatusFetchStatus.value === 'pending' && !lineStatusResponse.value,
);
const isForbidden = computed(() => {
  const status = getApiErrorStatusCode(lineStatusError.value);
  return status === 401 || status === 403;
});

const issueLineBindToken = async () => {
  if (!lineStatus.value || lineStatus.value.binding.status === 'bound' || isIssuing.value) return;

  isIssuing.value = true;
  actionError.value = null;

  try {
    const response = await getRequestFetch()<{
      data: { expiresAt: string; id: string; liffUrl: string; revokedTokenCount: number };
    }>(`/api/admin/work-orders/${encodeURIComponent(props.workOrderId)}/line-bind-token`, {
      body: {},
      method: 'POST',
    });
    issuedLiffUrl.value = response.data.liffUrl;
    await refreshLineStatus();
    toast.success('LINE 綁定連結已產生', {
      description: '如需紙本 QR，請再執行顧客留存聯補印。此操作不會自動建立列印任務。',
    });
  } catch (error) {
    actionError.value = extractApiErrorEnvelope(error);
    const statusCode = getApiErrorStatusCode(error);
    const message =
      statusCode === 401 || statusCode === 403
        ? '沒有權限執行 LINE 發卡操作。'
        : actionError.value?.error.code === 'CUSTOMER_ALREADY_BOUND'
          ? '顧客已綁定 LINE，不可重新發卡。'
          : actionError.value?.error.message || '產生 LINE 綁定連結失敗。';
    toast.error(message);
  } finally {
    isIssuing.value = false;
  }
};

const copyLiffUrl = async () => {
  if (!issuedLiffUrl.value) return;
  await navigator.clipboard.writeText(issuedLiffUrl.value);
  toast.success('LINE 綁定連結已複製');
};

const unlinkLineBinding = async () => {
  if (!lineStatus.value || lineStatus.value.binding.status !== 'bound' || isUnlinking.value) return;

  isUnlinking.value = true;
  actionError.value = null;

  try {
    const response = await getRequestFetch()<{
      data: {
        customerId: string;
        revokedTokenCount: number;
        skippedPendingJobCount: number;
        unlinkedAt: string;
      };
    }>(`/api/admin/customers/${encodeURIComponent(lineStatus.value.customerId)}/line-binding`, {
      method: 'DELETE',
    });
    unlinkDialogOpen.value = false;
    issuedLiffUrl.value = '';
    await refreshLineStatus();
    toast.success('LINE 綁定已解除', {
      description: `已撤銷 ${response.data.revokedTokenCount} 張待用憑證，略過 ${response.data.skippedPendingJobCount} 筆待送通知。`,
    });
  } catch (error) {
    actionError.value = extractApiErrorEnvelope(error);
    const statusCode = getApiErrorStatusCode(error);
    const message =
      statusCode === 401 || statusCode === 403
        ? '沒有權限解除 LINE 綁定。'
        : actionError.value?.error.code === 'NO_ACTIVE_LINE_BINDING'
          ? '此顧客目前沒有有效 LINE 綁定。'
          : actionError.value?.error.message || '解除 LINE 綁定失敗。';
    toast.error(message);
  } finally {
    isUnlinking.value = false;
  }
};
</script>

<template>
  <Card class="overflow-hidden">
    <CardHeader class="border-b bg-[linear-gradient(120deg,rgba(6,199,85,0.08),transparent_55%)]">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <CardTitle>LINE 聯絡狀態</CardTitle>
          <CardDescription>綁定與可通知狀態分開顯示；LINE API 接受不代表顧客已讀。</CardDescription>
        </div>
        <Badge v-if="lineStatus" variant="outline">
          {{ getAdminLineBindingLabel(lineStatus.binding) }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="space-y-5 pt-6">
      <div v-if="isLoading" class="space-y-3">
        <Skeleton class="h-6 w-44" />
        <Skeleton class="h-20 w-full" />
      </div>

      <Alert v-else-if="lineStatusError" variant="destructive">
        <AlertTitle>{{ isForbidden ? '沒有權限查看 LINE 狀態' : 'LINE 狀態載入失敗' }}</AlertTitle>
        <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
          <span>{{ isForbidden ? '請重新登入具管理權限的帳號。' : '請稍後再試。' }}</span>
          <Button
            v-if="!isForbidden"
            type="button"
            size="sm"
            variant="outline"
            @click="refreshLineStatus"
          >
            重新載入
          </Button>
        </AlertDescription>
      </Alert>

      <template v-else-if="lineStatus">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-1">
            <p class="text-xs font-medium tracking-wide text-muted-foreground">LINE 名稱</p>
            <p class="text-sm font-semibold">{{ lineStatus.binding.displayName || '—' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium tracking-wide text-muted-foreground">綁定時間</p>
            <p class="text-sm font-semibold">
              {{ formatAdminDateTime(lineStatus.binding.linkedAt) }}
            </p>
          </div>
          <div class="space-y-1">
            <p class="text-xs font-medium tracking-wide text-muted-foreground">最近憑證</p>
            <p class="text-sm font-semibold">
              {{ getAdminLineTokenStatusLabel(lineStatus.latestToken.status) }}
            </p>
          </div>
        </div>

        <div
          v-if="lineStatus.binding.status === 'unbound'"
          class="space-y-3 rounded-xl border bg-muted/20 p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-medium">顧客尚未綁定 LINE</p>
              <p class="text-sm text-muted-foreground">
                發卡只產生 LIFF 連結，不會自動建立 print job。
              </p>
            </div>
            <Button type="button" :disabled="isIssuing" @click="issueLineBindToken">
              <Spinner v-if="isIssuing" data-icon="inline-start" />
              <LinkIcon v-else data-icon="inline-start" />
              {{ lineStatus.latestToken.status === 'none' ? '產生 LINE 綁定連結' : '重新發卡' }}
            </Button>
          </div>

          <div v-if="issuedLiffUrl" class="space-y-2 rounded-lg border bg-background p-3">
            <div class="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckIcon class="size-4" />
              新連結已產生
            </div>
            <p class="break-all font-mono text-xs text-muted-foreground">{{ issuedLiffUrl }}</p>
            <Button type="button" size="sm" variant="outline" @click="copyLiffUrl">
              <CopyIcon data-icon="inline-start" />
              複製連結
            </Button>
            <p class="text-xs text-muted-foreground">需要紙本 QR 時，請另外補印顧客留存聯。</p>
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
            解除 LINE 綁定
          </Button>
        </div>

        <Alert v-if="actionError" variant="destructive">
          <AlertTitle>LINE 操作失敗</AlertTitle>
          <AlertDescription>{{ actionError.error.message }}</AlertDescription>
        </Alert>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold">最近 LINE 通知</p>
            <span class="text-xs text-muted-foreground">最多 5 筆</span>
          </div>
          <p
            v-if="lineStatus.recentJobs.length === 0"
            class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
          >
            尚無 LINE 通知紀錄。
          </p>
          <div v-else class="divide-y rounded-xl border">
            <div
              v-for="job in lineStatus.recentJobs.slice(0, 5)"
              :key="job.id"
              class="grid gap-2 p-3 sm:grid-cols-[1fr_auto]"
            >
              <div class="space-y-1">
                <p class="text-sm font-medium">{{ getAdminLineJobTypeLabel(job.jobType) }}</p>
                <p v-if="job.skipReason || job.lastError" class="text-xs text-muted-foreground">
                  {{ getAdminLineSkipReasonLabel(job.skipReason) || job.lastError }}
                </p>
                <p class="text-xs text-muted-foreground">
                  建立：{{ formatAdminDateTime(job.createdAt) }}
                </p>
              </div>
              <div class="text-left sm:text-right">
                <Badge variant="secondary">{{ getAdminLineJobStatusLabel(job.status) }}</Badge>
                <p class="mt-1 text-xs text-muted-foreground">
                  接受：{{ formatAdminDateTime(job.sentAt) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </CardContent>

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
            :disabled="isUnlinking"
            @click="unlinkDialogOpen = false"
            >取消</Button
          >
          <Button
            type="button"
            variant="destructive"
            :disabled="isUnlinking"
            @click="unlinkLineBinding"
          >
            <Spinner v-if="isUnlinking" data-icon="inline-start" />
            確認解除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>
