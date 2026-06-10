<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-vue-next';
import type { RepairCountSource, RepairMark, RepairMarkBoardType } from '~/utils/repair-marks';
import {
  adjustRepairMarkSize,
  cloneRepairMarks,
  deriveRepairCount,
  REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX,
  reindexRepairMarks,
  summarizeRepairMarks,
} from '~/utils/repair-marks';
import RepairMarksSurfaceGallery from '~/components/work-orders/RepairMarksSurfaceGallery.vue';

const props = defineProps<{
  boardType: RepairMarkBoardType;
  open: boolean;
  repairCount: string;
  repairCountSource: RepairCountSource;
  repairMarks: RepairMark[];
}>();

const emit = defineEmits<{
  (event: 'save', value: {
    repairCount: string;
    repairCountSource: RepairCountSource;
    repairMarks: RepairMark[];
  }): void;
  (event: 'update:open', value: boolean): void;
}>();

const selectedMarkId = ref<string | null>(null);
const draftMarks = ref<RepairMark[]>([]);
const draftRepairCount = ref('');
const draftRepairCountSource = ref<RepairCountSource>('auto');
const isThreeColumnLayout = useMediaQuery(
  `(min-width: ${REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX}px)`,
);
const isPortraitSingleSurfaceLayout = useMediaQuery(
  `(max-width: ${REPAIR_MARK_EDITOR_THREE_COLUMN_BREAKPOINT_PX - 1}px) and (orientation: portrait)`,
);

const syncDraft = () => {
  draftMarks.value = cloneRepairMarks(props.repairMarks);
  draftRepairCount.value = props.repairCount;
  draftRepairCountSource.value = props.repairCountSource;
  selectedMarkId.value = null;
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      syncDraft();
    }
  },
);

const summary = computed(() => summarizeRepairMarks(draftMarks.value));

watch(
  [draftMarks, draftRepairCountSource],
  () => {
    if (draftRepairCountSource.value === 'auto') {
      const derivedCount = deriveRepairCount(draftMarks.value);
      draftRepairCount.value = derivedCount === null ? '' : String(derivedCount);
    }
  },
  { deep: true, immediate: true },
);

const selectedMark = computed(() =>
  draftMarks.value.find((mark) => mark.id === selectedMarkId.value) ?? null,
);

const updateSelectedMark = (delta: number) => {
  if (!selectedMark.value) {
    return;
  }

  draftMarks.value = draftMarks.value.map((mark) =>
    mark.id === selectedMark.value?.id ? adjustRepairMarkSize(mark, delta) : mark,
  );
};

const removeSelectedMark = () => {
  if (!selectedMark.value) {
    return;
  }

  draftMarks.value = reindexRepairMarks(
    draftMarks.value.filter((mark) => mark.id !== selectedMark.value?.id),
  );
  selectedMarkId.value = null;
};

const closeDialog = () => emit('update:open', false);
const saveDialog = () => {
  emit('save', {
    repairCount: draftRepairCount.value,
    repairCountSource: draftRepairCountSource.value,
    repairMarks: reindexRepairMarks(draftMarks.value),
  });
  closeDialog();
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex h-[99dvh] w-[99vw] max-w-[84rem] flex-col overflow-hidden p-0">
      <DialogHeader>
        <div class="border-b px-5 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <DialogTitle>受損位置</DialogTitle>
          <DialogDescription>寬版時雙面同時顯示。點板面新增標記；拖曳、拉伸或用右側控制調整大小。</DialogDescription>
        </div>
      </DialogHeader>

      <div
        :class="
          isThreeColumnLayout || isPortraitSingleSurfaceLayout
            ? 'overflow-hidden'
            : 'overflow-y-auto'
        "
        class="min-h-0 flex-1 px-3 py-3 sm:px-4 sm:py-4"
      >
        <div
          :class="
            isThreeColumnLayout
              ? 'h-full grid-cols-[minmax(0,1fr)_15.5rem] items-stretch xl:grid-cols-[minmax(0,1fr)_16.5rem]'
              : isPortraitSingleSurfaceLayout
                ? 'h-full grid-cols-1 grid-rows-[minmax(0,1.08fr)_minmax(0,1fr)] items-stretch'
              : 'grid-cols-1 content-start'
          "
          class="grid min-h-0 gap-3"
        >
          <div :class="isThreeColumnLayout || isPortraitSingleSurfaceLayout ? 'min-h-0' : 'w-full'">
            <RepairMarksSurfaceGallery
              v-model:marks="draftMarks"
              v-model:selected-mark-id="selectedMarkId"
              :board-type="boardType"
              :canvas-height="860"
              :canvas-width="540"
              dual-surface-min-height-class="h-full min-h-0"
              editable
              :single-surface-canvas-wrapper-class="
                isPortraitSingleSurfaceLayout
                  ? 'mx-auto h-full min-h-0 w-full max-w-[24.5rem] sm:max-w-[25rem]'
                  : ''
              "
              :single-surface-gallery-class="isPortraitSingleSurfaceLayout ? 'gap-4' : ''"
              :single-surface-min-height-class="
                isPortraitSingleSurfaceLayout ? 'h-full min-h-0' : 'min-h-[25rem] sm:min-h-[29rem]'
              "
              surface-gap-class="gap-3"
            />
          </div>

          <Card
            :class="
              isThreeColumnLayout || isPortraitSingleSurfaceLayout
                ? 'flex h-full min-h-0 flex-col'
                : 'flex flex-col'
            "
          >
            <CardHeader :class="isPortraitSingleSurfaceLayout ? 'space-y-0.5 px-3 pb-1 pt-3' : 'space-y-1 pb-2'">
              <CardTitle class="text-base">標記設定</CardTitle>
              <CardDescription
                v-if="!isPortraitSingleSurfaceLayout"
                class="text-xs leading-5"
              >
                手動模式可讓維修處數與圈選數不同。
              </CardDescription>
            </CardHeader>
            <CardContent
              :class="
                isThreeColumnLayout || isPortraitSingleSurfaceLayout
                  ? 'flex h-full min-h-0 flex-col overflow-hidden pt-0'
                  : 'flex flex-col pt-0'
              "
            >
              <div
                :class="
                  isThreeColumnLayout
                    ? 'min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'
                    : isPortraitSingleSurfaceLayout
                      ? 'min-h-0 flex-1 space-y-1.5 overflow-hidden'
                    : 'space-y-3'
                "
              >
                <div :class="isPortraitSingleSurfaceLayout ? 'space-y-1 rounded-2xl border bg-muted/20 p-2' : 'space-y-2 rounded-2xl border bg-muted/20 p-3'">
                  <div :class="isPortraitSingleSurfaceLayout ? 'flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-foreground' : 'flex flex-wrap gap-2 text-sm font-medium text-foreground'">
                    <span>正面 {{ summary.frontCount }} 處</span>
                    <span>背面 {{ summary.backCount }} 處</span>
                    <span>共 {{ summary.totalCount }} 處</span>
                  </div>
                  <p :class="isPortraitSingleSurfaceLayout ? 'text-[10px] leading-3.5 text-muted-foreground' : 'text-xs leading-5 text-muted-foreground'">
                    點板面空白處新增。點既有圈選可拖曳或縮放。
                  </p>
                </div>

                <div :class="isPortraitSingleSurfaceLayout ? 'space-y-2' : 'space-y-3'">
                  <Field>
                    <FieldLabel>維修處數來源</FieldLabel>
                    <div :class="isPortraitSingleSurfaceLayout ? 'flex gap-1.5' : 'flex gap-2'">
                      <Button
                        type="button"
                        :variant="draftRepairCountSource === 'auto' ? 'default' : 'outline'"
                        :size="isPortraitSingleSurfaceLayout ? 'sm' : 'default'"
                        @click="draftRepairCountSource = 'auto'"
                      >
                        自動
                      </Button>
                      <Button
                        type="button"
                        :variant="draftRepairCountSource === 'manual' ? 'default' : 'outline'"
                        :size="isPortraitSingleSurfaceLayout ? 'sm' : 'default'"
                        @click="draftRepairCountSource = 'manual'"
                      >
                        手動
                      </Button>
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel for="repair-count-input">維修處數</FieldLabel>
                    <Input
                      id="repair-count-input"
                      v-model="draftRepairCount"
                      :disabled="draftRepairCountSource === 'auto'"
                      inputmode="numeric"
                      placeholder="自動帶入"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>選取中的標記</FieldLabel>
                    <div :class="isPortraitSingleSurfaceLayout ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="!selectedMark"
                        @click="updateSelectedMark(-0.12)"
                      >
                        <MinusIcon class="size-4" />
                        縮小
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        :disabled="!selectedMark"
                        @click="updateSelectedMark(0.12)"
                      >
                        <PlusIcon class="size-4" />
                        放大
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        :disabled="!selectedMark"
                        @click="removeSelectedMark"
                      >
                        <Trash2Icon class="size-4" />
                        刪除
                      </Button>
                    </div>
                    <FieldDescription :class="isPortraitSingleSurfaceLayout ? 'text-[11px] leading-4' : 'text-xs leading-5'">
                      若要調整橢圓度，可直接拖曳圈選框控制點。
                    </FieldDescription>
                  </Field>
                </div>
              </div>

              <div :class="isPortraitSingleSurfaceLayout ? 'mt-2 flex shrink-0 justify-end gap-2 border-t pt-2' : 'mt-3 flex shrink-0 justify-end gap-2 border-t pt-3'">
                <Button type="button" size="sm" variant="outline" @click="closeDialog">取消</Button>
                <Button type="button" size="sm" @click="saveDialog">儲存</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
