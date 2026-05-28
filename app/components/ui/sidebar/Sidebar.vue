<script setup lang="ts">
import type { SidebarProps } from '.';
import { computed, ref } from 'vue';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue';
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue';
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue';
import { SIDEBAR_WIDTH_MOBILE, SIDEBAR_WIDTH_MOBILE_PX, useSidebar } from './utils';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<SidebarProps>(), {
  side: 'left',
  variant: 'sidebar',
  collapsible: 'offcanvas',
});

const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

const MOBILE_SWIPE_EDGE_PX = 24;
const MOBILE_SWIPE_THRESHOLD_PX = 72;
const MOBILE_SWIPE_DIRECTION_LOCK_PX = 12;

const mobileSwipeOffset = ref(0);
const mobileSwipeMode = ref<'close' | 'open' | null>(null);
const mobileSwipeAxisLock = ref<'horizontal' | 'vertical' | null>(null);
const mobileSwipeStartX = ref(0);
const mobileSwipeStartY = ref(0);

const showMobileOpenSwipePreview = computed(
  () => mobileSwipeMode.value === 'open' && mobileSwipeOffset.value > 0,
);
const mobileOpenSwipePreviewStyle = computed(() => ({
  '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
  transform: `translateX(calc(-1 * var(--sidebar-width) + ${mobileSwipeOffset.value}px))`,
}));
const mobileSheetContentStyle = computed(() => ({
  '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
  transform:
    mobileSwipeMode.value === 'close' && mobileSwipeOffset.value > 0
      ? `translateX(-${mobileSwipeOffset.value}px)`
      : undefined,
}));

const resetMobileSwipe = () => {
  mobileSwipeOffset.value = 0;
  mobileSwipeMode.value = null;
  mobileSwipeAxisLock.value = null;
  mobileSwipeStartX.value = 0;
  mobileSwipeStartY.value = 0;
};

const getTouchPoint = (event: TouchEvent) => event.touches[0] ?? event.changedTouches[0] ?? null;

const startMobileSwipe = (event: TouchEvent, mode: 'close' | 'open') => {
  const touch = getTouchPoint(event);

  if (!touch) {
    return;
  }

  mobileSwipeMode.value = mode;
  mobileSwipeAxisLock.value = null;
  mobileSwipeOffset.value = 0;
  mobileSwipeStartX.value = touch.clientX;
  mobileSwipeStartY.value = touch.clientY;
};

const updateMobileSwipe = (event: TouchEvent) => {
  if (!mobileSwipeMode.value) {
    return;
  }

  const touch = getTouchPoint(event);

  if (!touch) {
    return;
  }

  const deltaX = touch.clientX - mobileSwipeStartX.value;
  const deltaY = touch.clientY - mobileSwipeStartY.value;

  if (!mobileSwipeAxisLock.value) {
    if (
      Math.abs(deltaX) < MOBILE_SWIPE_DIRECTION_LOCK_PX &&
      Math.abs(deltaY) < MOBILE_SWIPE_DIRECTION_LOCK_PX
    ) {
      return;
    }

    mobileSwipeAxisLock.value =
      Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
  }

  if (mobileSwipeAxisLock.value !== 'horizontal') {
    return;
  }

  event.preventDefault();

  if (mobileSwipeMode.value === 'open') {
    mobileSwipeOffset.value = Math.max(0, Math.min(deltaX, SIDEBAR_WIDTH_MOBILE_PX));
    return;
  }

  mobileSwipeOffset.value = Math.max(0, Math.min(-deltaX, SIDEBAR_WIDTH_MOBILE_PX));
};

const finishMobileSwipe = () => {
  if (mobileSwipeAxisLock.value !== 'horizontal' || !mobileSwipeMode.value) {
    resetMobileSwipe();
    return;
  }

  const shouldToggle =
    mobileSwipeMode.value === 'open'
      ? mobileSwipeOffset.value >= MOBILE_SWIPE_THRESHOLD_PX
      : mobileSwipeOffset.value >= MOBILE_SWIPE_THRESHOLD_PX;

  if (shouldToggle) {
    setOpenMobile(mobileSwipeMode.value === 'open');
  }

  resetMobileSwipe();
};

const handleMobileOpenSwipeStart = (event: TouchEvent) => {
  if (openMobile.value) {
    return;
  }

  const touch = getTouchPoint(event);

  if (!touch || touch.clientX > MOBILE_SWIPE_EDGE_PX) {
    return;
  }

  startMobileSwipe(event, 'open');
};

const handleMobileCloseSwipeStart = (event: TouchEvent) => {
  if (!openMobile.value) {
    return;
  }

  startMobileSwipe(event, 'close');
};
</script>

<template>
  <div
    v-if="collapsible === 'none'"
    data-slot="sidebar"
    :class="
      cn('bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col', props.class)
    "
    v-bind="$attrs"
  >
    <slot />
  </div>

  <template v-else-if="isMobile">
    <div
      v-if="!openMobile"
      class="fixed inset-y-0 left-0 z-30 w-6 touch-pan-y xl:hidden"
      aria-hidden="true"
      @touchcancel="resetMobileSwipe"
      @touchend="finishMobileSwipe"
      @touchmove="updateMobileSwipe"
      @touchstart.passive="handleMobileOpenSwipeStart"
    />

    <div
      v-if="showMobileOpenSwipePreview"
      class="bg-sidebar text-sidebar-foreground pointer-events-none fixed inset-y-0 left-0 z-40 w-(--sidebar-width) border-r shadow-lg xl:hidden"
      aria-hidden="true"
      :style="mobileOpenSwipePreviewStyle"
    />

    <Sheet :open="openMobile" v-bind="$attrs" @update:open="setOpenMobile">
      <SheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        :side="side"
        class="bg-sidebar text-sidebar-foreground touch-pan-y w-(--sidebar-width) p-0 [&>button]:hidden"
        :style="mobileSheetContentStyle"
        @touchcancel="resetMobileSwipe"
        @touchend="finishMobileSwipe"
        @touchmove="updateMobileSwipe"
        @touchstart.passive="handleMobileCloseSwipeStart"
      >
        <SheetHeader class="sr-only">
          <SheetTitle>Sidebar</SheetTitle>
          <SheetDescription>Displays the mobile sidebar.</SheetDescription>
        </SheetHeader>
        <div class="flex h-full w-full flex-col">
          <slot />
        </div>
      </SheetContent>
    </Sheet>
  </template>

  <div
    v-else
    class="group peer text-sidebar-foreground hidden xl:block"
    data-slot="sidebar"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- This is what handles the sidebar gap on desktop  -->
    <div
      data-slot="sidebar-gap"
      :class="
        cn(
          'transition-[width] duration-200 ease-linear relative w-(--sidebar-width) bg-transparent',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )
      "
    />
    <div
      data-slot="sidebar-container"
      :data-side="side"
      :class="
        cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear xl:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          props.class,
        )
      "
      v-bind="$attrs"
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full flex-col"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
