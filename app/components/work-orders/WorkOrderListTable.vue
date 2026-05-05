<script setup lang="ts">
import type { AdminWorkOrderListItem } from '~/utils/admin-work-orders';
import {
  formatAdminDate,
  formatAdminDateTime,
  getBoardLengthClassLabel,
  getBoardTypeLabel,
  getAdminWorkOrderDetailPath,
} from '~/utils/admin-work-orders';
import WorkOrderBoardColorSwatch from '~/components/work-orders/WorkOrderBoardColorSwatch.vue';
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
  <div class="hidden overflow-hidden rounded-lg border bg-card xl:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[9.5rem]">工單號</TableHead>
          <TableHead class="w-[8rem]">狀態</TableHead>
          <TableHead class="min-w-[11rem]">顧客</TableHead>
          <TableHead class="w-[9rem]">板型</TableHead>
          <TableHead class="w-[8rem]">預估完成日</TableHead>
          <TableHead class="min-w-[14rem]">提醒</TableHead>
          <TableHead class="w-[9rem]">最近更新</TableHead>
          <TableHead class="w-[8rem] text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableEmpty v-if="items.length === 0" :colspan="8"> 沒有可顯示的工單。 </TableEmpty>

        <TableRow
          v-for="workOrder in items"
          v-else
          :key="workOrder.id ?? workOrder.paperOrderNo ?? 'work-order-row'"
          class="cursor-pointer"
          role="link"
          tabindex="0"
          :aria-label="`查看工單 ${workOrder.paperOrderNo ?? '明細'}`"
          @click="emitView(workOrder.id)"
          @keydown.enter.prevent="emitView(workOrder.id)"
          @keydown.space.prevent="emitView(workOrder.id)"
        >
          <TableCell class="font-medium">{{ workOrder.paperOrderNo ?? '—' }}</TableCell>
          <TableCell>
            <WorkOrderStatusBadge :status="workOrder.currentStatus" />
          </TableCell>
          <TableCell>
            <div class="flex flex-col gap-0.5">
              <span class="font-medium">{{ workOrder.customer.name ?? '—' }}</span>
              <span class="text-sm text-muted-foreground">{{
                workOrder.customer.phone ?? '—'
              }}</span>
            </div>
          </TableCell>
          <TableCell>
            <div class="flex flex-col gap-0.5">
              <span>{{ getBoardTypeLabel(workOrder.board.boardType) }}</span>
              <span v-if="workOrder.board.sizeLabel" class="text-sm text-muted-foreground">
                {{ getBoardLengthClassLabel(workOrder.board.boardLengthClass) }} /
                {{ workOrder.board.sizeLabel }}
              </span>
              <span v-else class="text-sm text-muted-foreground">
                {{ getBoardLengthClassLabel(workOrder.board.boardLengthClass) }}
              </span>
              <WorkOrderBoardColorSwatch :color="workOrder.board.color" />
            </div>
          </TableCell>
          <TableCell>{{ formatAdminDate(workOrder.estimatedCompletionDate) }}</TableCell>
          <TableCell>
            <WorkOrderFlagBadges :flags="workOrder.flags" />
          </TableCell>
          <TableCell>{{ formatAdminDateTime(workOrder.lastUpdatedAt) }}</TableCell>
          <TableCell class="text-right">
            <Button
              v-if="workOrder.id"
              as-child
              size="sm"
              type="button"
              variant="outline"
              @click.stop
            >
              <NuxtLink :to="getAdminWorkOrderDetailPath(workOrder.id)">查看詳情</NuxtLink>
            </Button>
            <span v-else class="text-sm text-muted-foreground">—</span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
