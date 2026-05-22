<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { DialogOverlay } from 'reka-ui';
import { cn } from '@/lib/utils';

interface Props extends DialogOverlayProps {
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    :class="
      cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        props.class,
      )
    "
  />
</template>
