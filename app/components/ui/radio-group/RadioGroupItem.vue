<script setup lang="ts">
import type { RadioGroupItemEmits, RadioGroupItemProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { CircleIcon } from 'lucide-vue-next';
import { RadioGroupIndicator, RadioGroupItem, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<RadioGroupItemEmits>();

const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="forwarded"
    :class="
      cn(
        'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 shrink-0 items-center justify-center rounded-full border bg-background shadow-xs outline-none transition-shadow focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <RadioGroupIndicator
      data-slot="radio-group-indicator"
      class="flex items-center justify-center"
    >
      <CircleIcon class="size-2 fill-current text-current" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
