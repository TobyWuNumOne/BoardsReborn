<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { XIcon } from 'lucide-vue-next';
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import DialogOverlay from './DialogOverlay.vue';

interface Props extends DialogContentProps {
  class?: HTMLAttributes['class'];
  showCloseButton?: boolean;
}

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<Props>(), {
  showCloseButton: true,
});
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = reactiveOmit(props, 'class', 'showCloseButton');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      :class="
        cn(
          'bg-background fixed top-[50%] left-[50%] z-50 grid w-[min(calc(100vw-2rem),32rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          props.class,
        )
      "
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <DialogClose v-if="showCloseButton" data-slot="dialog-close" as-child>
        <Button variant="ghost" class="absolute top-4 right-4" size="icon-sm">
          <XIcon />
          <span class="sr-only">Close</span>
        </Button>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
