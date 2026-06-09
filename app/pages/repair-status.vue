<script setup lang="ts">
import { RotateCcwIcon, SearchIcon } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import type {
  PublicApiErrorEnvelope,
  PublicWorkOrderLookupPayload,
  PublicWorkOrderLookupResponse,
} from '~/utils/public-work-order-lookup';
import {
  buildPublicWorkOrderLookupPayload,
  createPublicWorkOrderLookupFormState,
  extractPublicApiErrorEnvelope,
  formatPublicCurrency,
  formatPublicDate,
  formatPublicDateTime,
} from '~/utils/public-work-order-lookup';
import RepairMarksSurfaceGallery from '~/components/work-orders/RepairMarksSurfaceGallery.vue';
import { getRepairMarkSurfaceLabel } from '~/utils/repair-marks';

type RequestFetch = <T>(request: string, options?: Record<string, unknown>) => Promise<T>;

useHead({
  title: '查詢維修進度 | BoardsReborn',
  meta: [
    {
      name: 'description',
      content: '使用紙本工單號與手機號碼查詢目前維修進度。',
    },
  ],
});

const getRequestFetch = (): RequestFetch => {
  if (import.meta.server) {
    return useRequestFetch() as RequestFetch;
  }

  return $fetch as unknown as RequestFetch;
};

const form = reactive(createPublicWorkOrderLookupFormState());
const clientFieldErrors = ref<Record<string, string[]>>({});
const lookupStatus = ref<'error' | 'idle' | 'loading' | 'success'>('idle');
const lookupApiError = shallowRef<PublicApiErrorEnvelope | null>(null);
const result = shallowRef<PublicWorkOrderLookupResponse['data'] | null>(null);
const lastSubmittedPayload = shallowRef<PublicWorkOrderLookupPayload | null>(null);

const mergedFieldErrors = computed<Record<string, string[]>>(() => ({
  ...(lookupApiError.value?.error.fieldErrors ?? {}),
  ...clientFieldErrors.value,
}));
const formAlertMessage = computed(() => lookupApiError.value?.error.message ?? '');
const timelineProgress = computed(() =>
  result.value?.progress.kind === 'timeline' ? result.value.progress : null,
);
const isSubmitting = computed(() => lookupStatus.value === 'loading');

const clearFieldError = (field: string) => {
  if (!(field in clientFieldErrors.value)) {
    return;
  }

  clientFieldErrors.value = Object.fromEntries(
    Object.entries(clientFieldErrors.value).filter(([entryField]) => entryField !== field),
  );
};

const resetLookupState = () => {
  lookupStatus.value = 'idle';
  lookupApiError.value = null;
  result.value = null;
};

const resetForm = () => {
  Object.assign(form, createPublicWorkOrderLookupFormState());
  clientFieldErrors.value = {};
  lastSubmittedPayload.value = null;
  resetLookupState();
};

watch(
  () => [form.paperOrderNo, form.phone],
  ([rawPaperOrderNo, rawPhone]) => {
    const paperOrderNo = rawPaperOrderNo ?? '';
    const phone = rawPhone ?? '';

    if (paperOrderNo.trim() !== '') {
      clearFieldError('paperOrderNo');
    }

    if (phone.trim() !== '') {
      clearFieldError('phone');
    }

    if (!lastSubmittedPayload.value) {
      return;
    }

    const nextPaperOrderNo = paperOrderNo.trim();
    const nextPhone = phone.replaceAll(/\D/g, '');
    const lastPhoneDigits = lastSubmittedPayload.value.phone.replaceAll(/\D/g, '');

    if (
      nextPaperOrderNo !== lastSubmittedPayload.value.paperOrderNo ||
      nextPhone !== lastPhoneDigits
    ) {
      resetLookupState();
    }
  },
);

const lookupPublicWorkOrder = async () => {
  clientFieldErrors.value = {};
  lookupApiError.value = null;

  const payloadResult = buildPublicWorkOrderLookupPayload(form);

  if (!payloadResult.data) {
    clientFieldErrors.value = payloadResult.fieldErrors ?? {};
    return;
  }

  lookupStatus.value = 'loading';

  try {
    const response = await getRequestFetch()<PublicWorkOrderLookupResponse>(
      '/api/public/work-orders/lookup',
      {
        body: payloadResult.data,
        method: 'POST',
      },
    );

    result.value = response.data;
    lookupStatus.value = 'success';
    lastSubmittedPayload.value = payloadResult.data;
  } catch (error) {
    lookupStatus.value = 'error';
    lookupApiError.value = extractPublicApiErrorEnvelope(error);

    if (!lookupApiError.value) {
      lookupApiError.value = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '查詢失敗，請稍後再試。',
        },
      };
    }
  }
};
</script>

<template>
  <div class="min-h-svh bg-muted/20">
    <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardHeader class="space-y-3">
          <Badge variant="secondary" class="w-fit">BoardsReborn</Badge>
          <div class="space-y-2">
            <CardTitle class="text-3xl">查詢維修進度</CardTitle>
            <CardDescription class="max-w-2xl text-base leading-7">
              請輸入紙本工單號與手機號碼，查詢目前維修進度、預估完成日與公開備註。
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent class="space-y-6">
          <form class="space-y-6" @submit.prevent="lookupPublicWorkOrder">
            <div class="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel for="paper-order-no">紙本工單號</FieldLabel>
                <Input
                  id="paper-order-no"
                  v-model="form.paperOrderNo"
                  autocomplete="off"
                  name="paperOrderNo"
                  placeholder="例如 BR-2026-0001"
                />
                <FieldDescription>請輸入紙本工單號，系統會自動去除前後空白。</FieldDescription>
                <FieldError :errors="mergedFieldErrors.paperOrderNo" />
              </Field>

              <Field>
                <FieldLabel for="phone">手機號碼</FieldLabel>
                <Input
                  id="phone"
                  v-model="form.phone"
                  autocomplete="tel"
                  inputmode="tel"
                  name="phone"
                  placeholder="0912345678"
                />
                <FieldDescription>請輸入建立工單時留下的完整台灣手機號碼。</FieldDescription>
                <FieldError :errors="mergedFieldErrors.phone" />
              </Field>
            </div>

            <Alert v-if="formAlertMessage" variant="destructive">
              <AlertTitle>查詢失敗</AlertTitle>
              <AlertDescription>{{ formAlertMessage }}</AlertDescription>
            </Alert>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button :disabled="isSubmitting" type="submit" class="sm:min-w-36">
                <Spinner v-if="isSubmitting" data-icon="inline-start" />
                <SearchIcon v-else class="size-4" />
                {{ isSubmitting ? '查詢中...' : '查詢進度' }}
              </Button>
              <Button :disabled="isSubmitting" type="button" variant="outline" @click="resetForm">
                <RotateCcwIcon class="size-4" />
                清除
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card v-if="lookupStatus === 'success' && result">
        <CardHeader class="space-y-4">
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          >
            <div class="space-y-2">
              <CardTitle class="text-2xl">{{ result.paperOrderNo }}</CardTitle>
              <CardDescription>最近更新：{{ formatPublicDateTime(result.lastUpdatedAt) }}</CardDescription>
            </div>
            <Badge variant="outline" class="w-fit px-3 py-1 text-sm">
              {{ result.statusLabel }}
            </Badge>
          </div>
        </CardHeader>

        <CardContent class="space-y-6">
          <div v-if="timelineProgress" class="space-y-4">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold">目前進度</h2>
              <p class="text-sm text-muted-foreground">依目前工單狀態顯示公開進度。</p>
            </div>

            <ol class="space-y-0">
              <li
                v-for="(step, index) in timelineProgress.steps"
                :key="step.key"
                class="flex gap-4"
              >
                <div class="flex flex-col items-center">
                  <div
                    :class="
                      cn(
                        'flex size-8 items-center justify-center rounded-full border text-xs font-semibold',
                        step.state === 'done' &&
                          'border-emerald-500 bg-emerald-500 text-white shadow-sm',
                        step.state === 'current' &&
                          'border-sky-600 bg-sky-600 text-white shadow-sm',
                        step.state === 'upcoming' && 'border-slate-200 bg-background text-slate-500',
                      )
                    "
                  >
                    {{ index + 1 }}
                  </div>
                  <div
                    v-if="index < timelineProgress.steps.length - 1"
                    :class="
                      cn(
                        'mt-2 min-h-8 w-px flex-1',
                        step.state === 'done' ? 'bg-emerald-500' : 'bg-border',
                      )
                    "
                  />
                </div>

                <div class="pb-6 pt-1">
                  <p class="font-medium text-foreground">{{ step.label }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{
                      step.state === 'current'
                        ? '目前階段'
                        : step.state === 'done'
                          ? '已完成'
                          : '尚未開始'
                    }}
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <Alert v-else-if="result.progress.kind === 'cancelled'" variant="destructive">
            <AlertTitle>工單已取消</AlertTitle>
            <AlertDescription>{{ result.progress.message }}</AlertDescription>
          </Alert>

          <Separator />

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1 rounded-lg border bg-background p-4">
              <p class="text-sm text-muted-foreground">預估完成日</p>
              <p class="text-base font-medium">{{ formatPublicDate(result.estimatedCompletionDate) }}</p>
            </div>

            <div class="space-y-1 rounded-lg border bg-background p-4">
              <p class="text-sm text-muted-foreground">初始報價</p>
              <p class="text-base font-medium">{{ formatPublicCurrency(result.initialQuoteAmount) }}</p>
            </div>
          </div>

          <div class="space-y-3 rounded-lg border bg-background p-4">
            <div class="flex flex-wrap gap-2">
              <Badge variant="outline">
                {{ getRepairMarkSurfaceLabel(result.boardType, 'front') }} {{ result.repairMarks.filter((mark) => mark.boardSide === 'front').length }} 處
              </Badge>
              <Badge variant="outline">
                {{ getRepairMarkSurfaceLabel(result.boardType, 'back') }} {{ result.repairMarks.filter((mark) => mark.boardSide === 'back').length }} 處
              </Badge>
              <Badge variant="outline">維修處數 {{ result.repairCount ?? '—' }}</Badge>
            </div>

            <RepairMarksSurfaceGallery
              :board-type="result.boardType"
              :canvas-height="760"
              :canvas-width="500"
              dual-surface-min-height-class="min-h-[20rem] xl:min-h-[28rem]"
              :marks="result.repairMarks"
              single-surface-min-height-class="min-h-[28rem] xl:min-h-[34rem]"
              surface-gap-class="gap-4"
            />
          </div>

          <div class="space-y-2 rounded-lg border bg-background p-4">
            <h2 class="font-medium">公開備註</h2>
            <p class="text-sm leading-6 text-muted-foreground">
              {{ result.publicNote?.trim() || '目前沒有公開備註。' }}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
