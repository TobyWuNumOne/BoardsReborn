<script setup lang="ts">
import type { AdminWorkOrderListItem } from '~/utils/admin-work-orders';
import {
  formatAdminDate,
  formatAdminDateTime,
  getAdminWorkOrderDetailPath,
  getBoardTypeLabel,
} from '~/utils/admin-work-orders';
import WorkOrderFlagBadges from '~/components/work-orders/WorkOrderFlagBadges.vue';
import WorkOrderStatusBadge from '~/components/work-orders/WorkOrderStatusBadge.vue';

defineProps<{
  items: AdminWorkOrderListItem[];
}>();

const emit = defineEmits<{
  view: [id: string];
}>();

const emitView = (id: string | null) => {
  if (!id) {
    return;
  }

  emit('view', id);
};
</script>

<template>
  <div class="grid gap-3 xl:hidden">
    <Card
      v-for="workOrder in items"
      :key="workOrder.id ?? workOrder.paperOrderNo ?? 'work-order-card'"
      class="cursor-pointer"
      role="link"
      tabindex="0"
      :aria-label="`查看工單 ${workOrder.paperOrderNo ?? '明細'}`"
      @click="emitView(workOrder.id)"
      @keydown.enter.prevent="emitView(workOrder.id)"
      @keydown.space.prevent="emitView(workOrder.id)"
    >
      <CardHeader class="gap-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <CardTitle class="text-lg">{{ workOrder.paperOrderNo ?? '—' }}</CardTitle>
            <CardDescription class="mt-1">
              {{ workOrder.customer.name ?? '—' }} / {{ workOrder.customer.phone ?? '—' }}
            </CardDescription>
          </div>
          <WorkOrderStatusBadge :status="workOrder.currentStatus" />
        </div>
      </CardHeader>

      <CardContent class="grid gap-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground">板型</span>
            <span>{{ getBoardTypeLabel(workOrder.board.boardType) }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground">尺寸</span>
            <span>{{ workOrder.board.sizeLabel ?? '—' }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground">預估完成日</span>
            <span>{{ formatAdminDate(workOrder.estimatedCompletionDate) }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground">最近更新</span>
            <span>{{ formatAdminDateTime(workOrder.lastUpdatedAt) }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-muted-foreground">提醒</span>
          <WorkOrderFlagBadges :flags="workOrder.flags" />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          v-if="workOrder.id"
          as-child
          class="w-full"
          size="sm"
          type="button"
          variant="outline"
          @click.stop
        >
          <NuxtLink :to="getAdminWorkOrderDetailPath(workOrder.id)">查看詳情</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>
