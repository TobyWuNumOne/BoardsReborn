<script setup lang="ts">
import { getBoardColorSwatchMeta } from '~/utils/admin-work-orders';

const props = withDefaults(
  defineProps<{
    color: string | null;
    emptyLabel?: string;
  }>(),
  {
    emptyLabel: '—',
  },
);

const colorMeta = computed(() => getBoardColorSwatchMeta(props.color));
</script>

<template>
  <div v-if="colorMeta" class="flex items-center gap-2">
    <span
      aria-hidden="true"
      class="size-3 shrink-0 rounded-[3px] border"
      :class="colorMeta.swatchClass"
    />
    <span class="text-sm text-muted-foreground">{{ colorMeta.label }}</span>
  </div>
  <span v-else class="text-sm text-muted-foreground">{{ emptyLabel }}</span>
</template>
