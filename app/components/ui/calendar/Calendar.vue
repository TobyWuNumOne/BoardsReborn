<script setup lang="ts">
import type { CalendarRootEmits, CalendarRootProps } from 'reka-ui';

import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-vue-next';
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  useForwardPropsEmits,
} from 'reka-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<CalendarRootProps & { class?: HTMLAttributes['class'] }>(),
  {
    fixedWeeks: true,
    locale: 'zh-TW',
    weekStartsOn: 0,
    weekdayFormat: 'short',
  },
);
const emits = defineEmits<CalendarRootEmits>();

const delegatedProps = reactiveOmit(props, 'class');
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CalendarRoot v-slot="{ grid, weekDays }" data-slot="calendar" v-bind="forwarded">
    <div :class="cn('space-y-4', props.class)">
      <div v-for="month in grid" :key="month.value.toString()" class="space-y-4">
        <CalendarHeader class="flex items-center justify-between gap-2">
          <CalendarPrev as-child>
            <Button type="button" variant="outline" size="icon-sm" class="size-8">
              <ChevronLeftIcon />
              <span class="sr-only">上一個月</span>
            </Button>
          </CalendarPrev>

          <CalendarHeading class="text-sm font-medium" />

          <CalendarNext as-child>
            <Button type="button" variant="outline" size="icon-sm" class="size-8">
              <ChevronRightIcon />
              <span class="sr-only">下一個月</span>
            </Button>
          </CalendarNext>
        </CalendarHeader>

        <CalendarGrid class="w-full border-collapse select-none">
          <CalendarGridHead>
            <CalendarGridRow class="mb-1 grid grid-cols-7 gap-1">
              <CalendarHeadCell
                v-for="day in weekDays"
                :key="day"
                class="text-muted-foreground flex h-9 items-center justify-center text-xs font-medium"
              >
                {{ day }}
              </CalendarHeadCell>
            </CalendarGridRow>
          </CalendarGridHead>

          <CalendarGridBody class="grid gap-1">
            <CalendarGridRow
              v-for="(weekDates, weekIndex) in month.rows"
              :key="`${month.value.toString()}-${weekIndex}`"
              class="grid grid-cols-7 gap-1"
            >
              <CalendarCell
                v-for="weekDate in weekDates"
                :key="weekDate.toString()"
                :date="weekDate"
                class="contents"
              >
                <CalendarCellTrigger
                  :day="weekDate"
                  :month="month.value"
                  :class="
                    cn(
                      'flex h-9 w-full items-center justify-center rounded-md border border-transparent text-sm outline-none transition-colors hover:bg-muted data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[today]:border-primary/30 data-[today]:text-primary data-[outside-view]:text-muted-foreground/50 data-[outside-visible-view]:text-muted-foreground/50 data-[disabled]:text-muted-foreground/50 data-[disabled]:cursor-not-allowed data-[unavailable]:text-muted-foreground/50 data-[unavailable]:cursor-not-allowed',
                    )
                  "
                />
              </CalendarCell>
            </CalendarGridRow>
          </CalendarGridBody>
        </CalendarGrid>
      </div>
    </div>
  </CalendarRoot>
</template>
