<script setup lang="ts">
import { computed } from 'vue';
import type { StatusTone } from '~/utils/admin-printing';

const props = withDefaults(
  defineProps<{
    tone: StatusTone;
  }>(),
  {},
);

const toneClass = computed(() => {
  switch (props.tone) {
    case 'success':
      return 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]';
    case 'danger':
      return 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.14)]';
    case 'warning':
      return 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.14)]';
    case 'inactive':
      return 'bg-slate-500 shadow-[0_0_0_3px_rgba(100,116,139,0.16)]';
    case 'muted':
    default:
      return 'bg-slate-300 shadow-[0_0_0_3px_rgba(148,163,184,0.14)]';
  }
});
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-flex size-2.5 shrink-0 rounded-full"
    :class="toneClass"
  />
</template>
