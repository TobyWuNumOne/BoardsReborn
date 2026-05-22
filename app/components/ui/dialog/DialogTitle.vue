<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { DialogTitle } from 'reka-ui';
import { cn } from '@/lib/utils';

interface Props extends DialogTitleProps {
  class?: HTMLAttributes['class'];
}

const props = defineProps<Props>();
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    :class="cn('text-lg leading-none font-semibold', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
