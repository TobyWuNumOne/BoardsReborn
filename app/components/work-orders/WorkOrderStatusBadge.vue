<script setup lang="ts">
import type { Database } from '../../../types/database.types';
import { getWorkOrderStatusMeta } from '~/utils/admin-work-orders';

type WorkOrderStatus = Database['public']['Enums']['work_order_status'];

const props = defineProps<{
  status: WorkOrderStatus | null;
}>();

const statusMeta = computed(() => getWorkOrderStatusMeta(props.status));
</script>

<template>
  <Badge
    v-if="statusMeta"
    :variant="statusMeta.variant"
    :class="statusMeta.badgeClass"
    class="justify-center"
  >
    {{ statusMeta.label }}
  </Badge>
  <span v-else class="text-sm text-muted-foreground">—</span>
</template>
