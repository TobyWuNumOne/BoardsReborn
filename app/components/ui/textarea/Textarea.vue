<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useVModel } from '@vueuse/core';
import { cn } from '@/lib/utils';

const props = defineProps<{
  defaultValue?: string;
  modelValue?: string;
  class?: HTMLAttributes['class'];
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string): void;
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
  defaultValue: props.defaultValue,
  passive: true,
});
</script>

<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="
      cn(
        'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive min-h-28 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-3 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y w-full min-w-0',
        props.class,
      )
    "
  />
</template>
