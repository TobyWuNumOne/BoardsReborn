<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <main
    data-slot="sidebar-inset"
    :class="
      cn(
        'bg-background xl:peer-data-[variant=inset]:m-2 xl:peer-data-[variant=inset]:ml-0 xl:peer-data-[variant=inset]:rounded-xl xl:peer-data-[variant=inset]:shadow-sm xl:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 relative flex w-full flex-1 flex-col',
        props.class,
      )
    "
  >
    <slot />
  </main>
</template>
