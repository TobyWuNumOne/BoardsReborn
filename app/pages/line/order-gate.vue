<script setup lang="ts">
import { AlertCircleIcon, CheckCircle2Icon, ExternalLinkIcon, WavesIcon } from 'lucide-vue-next';
import { getLineLiffTokens } from '~/utils/line-liff';

type GateState =
  | 'loading'
  | 'pending'
  | 'used'
  | 'expired'
  | 'revoked'
  | 'invalid'
  | 'success'
  | 'already_linked'
  | 'line_conflict'
  | 'customer_conflict'
  | 'platform_error'
  | 'error';

interface ResolveData {
  canBind: boolean;
  tokenState: 'pending' | 'used' | 'expired' | 'revoked';
  workOrder: { boardType: string; paperOrderNo: string };
}

const route = useRoute();
const config = useRuntimeConfig();
const state = ref<GateState>('loading');
const summary = shallowRef<ResolveData['workOrder'] | null>(null);
const notificationStatus = ref('unknown');
const isBinding = ref(false);
const message = ref('');
const token = computed(() => (typeof route.query.t === 'string' ? route.query.t : ''));
const repairStatusUrl = '/repair-status';
const officialLineUrl = computed(() => config.public.lineOfficialUrl || '#');

useHead({
  title: 'LINE 綁定 | BoardsReborn',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const errorCode = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return null;
  const data = 'data' in error ? error.data : null;
  if (typeof data !== 'object' || data === null || !('error' in data)) return null;
  const envelope = data.error;
  return typeof envelope === 'object' && envelope !== null && 'code' in envelope
    ? String(envelope.code)
    : null;
};

const resolveToken = async () => {
  if (!token.value) {
    state.value = 'invalid';
    return;
  }

  state.value = 'loading';
  try {
    const response = await $fetch<{ data: ResolveData }>('/api/public/line-bind/resolve', {
      body: { token: token.value },
      method: 'POST',
    });
    summary.value = response.data.workOrder;
    state.value = response.data.tokenState;
  } catch (error) {
    state.value = errorCode(error) === 'TOKEN_INVALID' ? 'invalid' : 'error';
  }
};

const bindLine = async () => {
  isBinding.value = true;
  message.value = '';
  try {
    const tokens = await getLineLiffTokens(config.public.liffId);
    if (!tokens) return;
    const response = await $fetch<{
      data: {
        binding: { notificationStatus: string };
        outcome: 'already_linked' | 'linked';
        workOrder: { paperOrderNo: string };
      };
    }>('/api/public/line-bind/confirm', {
      body: { token: token.value, ...tokens },
      method: 'POST',
    });
    summary.value = { boardType: summary.value?.boardType ?? '', ...response.data.workOrder };
    notificationStatus.value = response.data.binding.notificationStatus;
    state.value = response.data.outcome === 'already_linked' ? 'already_linked' : 'success';
  } catch (error) {
    const code = errorCode(error);
    if (code === 'LINE_ALREADY_BOUND_TO_OTHER_CUSTOMER') state.value = 'line_conflict';
    else if (code === 'CUSTOMER_ALREADY_BOUND_TO_OTHER_LINE') state.value = 'customer_conflict';
    else if (code === 'LINE_PLATFORM_UNAVAILABLE') state.value = 'platform_error';
    else if (code === 'TOKEN_EXPIRED') state.value = 'expired';
    else if (code === 'TOKEN_REVOKED') state.value = 'revoked';
    else if (code === 'TOKEN_USED') state.value = 'used';
    else {
      state.value = 'error';
      message.value = error instanceof Error ? error.message : '綁定失敗，請稍後再試。';
    }
  } finally {
    isBinding.value = false;
  }
};

onMounted(resolveToken);
</script>

<template>
  <main
    class="min-h-svh bg-[radial-gradient(circle_at_top,_oklch(0.94_0.05_190),_transparent_48%),linear-gradient(to_bottom,_white,_oklch(0.97_0.01_220))] px-4 py-8 sm:py-14"
  >
    <Card class="mx-auto max-w-xl overflow-hidden border-slate-200 shadow-xl shadow-slate-900/5">
      <div class="h-2 bg-gradient-to-r from-cyan-600 via-teal-500 to-amber-400" />
      <CardHeader class="space-y-4 text-center">
        <div
          class="mx-auto flex size-14 items-center justify-center rounded-full bg-cyan-950 text-white"
        >
          <WavesIcon class="size-7" />
        </div>
        <div>
          <Badge variant="secondary">BoardsReborn 板再生</Badge>
          <CardTitle class="mt-3 text-2xl">維修工單 LINE 通知</CardTitle>
          <CardDescription v-if="summary" class="mt-2 text-base">
            工單 {{ summary.paperOrderNo }} · {{ summary.boardType }}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-5">
        <div
          v-if="state === 'loading'"
          class="flex items-center justify-center gap-3 py-10 text-muted-foreground"
        >
          <Spinner /> 正在確認綁定連結…
        </div>

        <template v-else-if="state === 'pending'">
          <Alert
            ><AlertCircleIcon /><AlertTitle>接收維修進度通知</AlertTitle
            ><AlertDescription
              >加入並綁定官方 LINE，後續完工通知會透過 LINE 傳送。</AlertDescription
            ></Alert
          >
          <Button class="h-12 w-full text-base" :disabled="isBinding" @click="bindLine">
            <Spinner v-if="isBinding" />{{ isBinding ? '正在連接 LINE…' : '綁定 LINE 接收通知' }}
          </Button>
        </template>

        <Alert v-else-if="state === 'used'"
          ><CheckCircle2Icon /><AlertTitle>此 QR 的 LINE 綁定程序已完成</AlertTitle
          ><AlertDescription>這組一次性憑證不能再次綁定。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'expired'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>綁定連結已過期</AlertTitle
          ><AlertDescription>請聯絡店家重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'revoked'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>綁定連結已失效</AlertTitle
          ><AlertDescription>請聯絡店家重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'invalid'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>無效的綁定連結</AlertTitle
          ><AlertDescription>請確認 QR Code 或聯絡店家。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'success' || state === 'already_linked'"
          ><CheckCircle2Icon /><AlertTitle>已完成 LINE 綁定</AlertTitle
          ><AlertDescription
            >{{
              state === 'already_linked'
                ? '此 LINE 已綁定同一位顧客。'
                : '後續將透過官方 LINE 提供通知。'
            }}
            通知狀態：{{ notificationStatus }}</AlertDescription
          ></Alert
        >
        <Alert
          v-else-if="state === 'line_conflict' || state === 'customer_conflict'"
          variant="destructive"
          ><AlertCircleIcon /><AlertTitle>無法完成綁定</AlertTitle
          ><AlertDescription>請聯絡店家協助解除舊綁定並重新發卡。</AlertDescription></Alert
        >
        <Alert v-else-if="state === 'platform_error'" variant="destructive"
          ><AlertCircleIcon /><AlertTitle>LINE 服務暫時無法使用</AlertTitle
          ><AlertDescription>請稍後重新開啟此頁。</AlertDescription></Alert
        >
        <Alert v-else variant="destructive"
          ><AlertCircleIcon /><AlertTitle>目前無法完成操作</AlertTitle
          ><AlertDescription>{{ message || '請稍後再試或聯絡店家。' }}</AlertDescription></Alert
        >

        <div v-if="state !== 'loading' && state !== 'pending'" class="grid gap-3 sm:grid-cols-2">
          <Button as-child variant="outline"
            ><NuxtLink :to="repairStatusUrl">查詢維修進度</NuxtLink></Button
          >
          <Button as-child
            ><a :href="officialLineUrl" target="_blank" rel="noreferrer"
              >聯絡官方 LINE <ExternalLinkIcon /></a
          ></Button>
        </div>
        <p
          v-if="state === 'success' || state === 'already_linked'"
          class="text-center text-sm text-muted-foreground"
        >
          查詢維修進度時仍需輸入工單號與完整手機號碼。
        </p>
      </CardContent>
    </Card>
  </main>
</template>
