<script setup lang="ts">
import type { WorkOrderListFlags } from '~/utils/admin-work-orders';
import { getActiveWorkOrderFlags, getWorkOrderFlagMeta } from '~/utils/admin-work-orders';

const props = withDefaults(
  defineProps<{
    emptyLabel?: string;
    flags: WorkOrderListFlags;
    showEmpty?: boolean;
  }>(),
  {
    emptyLabel: '—',
    showEmpty: true,
  },
);

const activeFlags = computed(() => getActiveWorkOrderFlags(props.flags));
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <template v-if="activeFlags.length > 0">
      <Badge
        v-for="flag in activeFlags"
        :key="flag"
        :variant="getWorkOrderFlagMeta(flag).variant"
        :class="getWorkOrderFlagMeta(flag).badgeClass"
      >
        {{ getWorkOrderFlagMeta(flag).label }}
      </Badge>
    </template>

    <span v-else-if="showEmpty" class="text-sm text-muted-foreground">
      {{ emptyLabel }}
    </span>
  </div>
</template>
