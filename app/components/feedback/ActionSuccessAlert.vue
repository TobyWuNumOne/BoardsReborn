<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { CheckCircle2Icon, XIcon } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    description?: string;
    dismissible?: boolean;
    title: string;
  }>(),
  {
    class: undefined,
    description: '',
    dismissible: false,
  },
);

defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <Alert
    :class="
      cn(
        'border-emerald-200 bg-emerald-50/90 text-emerald-950 [&_[data-slot=alert-description]]:text-emerald-900/80 [&_[data-slot=alert-title]]:text-emerald-950 [&>svg]:text-emerald-700',
        props.class,
      )
    "
  >
    <CheckCircle2Icon />
    <AlertTitle>{{ title }}</AlertTitle>
    <AlertDescription v-if="description">
      {{ description }}
    </AlertDescription>
    <AlertAction v-if="dismissible">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-7 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
        @click="$emit('dismiss')"
      >
        <XIcon class="size-4" />
        <span class="sr-only">關閉提示</span>
      </Button>
    </AlertAction>
  </Alert>
</template>
