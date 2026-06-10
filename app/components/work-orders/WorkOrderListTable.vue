<script setup lang="ts">
import type { AdminWorkOrderListItem } from '~/utils/admin-work-orders';
import {
  formatAdminDate,
  getBoardLengthClassLabel,
  getBoardTypeLabel,
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
  <div class="overflow-x-auto rounded-lg border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-38">工單號</TableHead>
          <TableHead class="w-22 text-center">維修數量</TableHead>
          <TableHead class="w-32">狀態</TableHead>
          <TableHead class="min-w-44">顧客</TableHead>
          <TableHead class="w-36">板型</TableHead>
          <TableHead class="w-32">收件時間</TableHead>
          <TableHead class="min-w-56">提醒</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableEmpty v-if="items.length === 0" :colspan="7"> 沒有可顯示的工單。 </TableEmpty>

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
          <TableCell class="text-center">
            {{ workOrder.repairCount ?? '—' }}
          </TableCell>
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
          <TableCell>{{ formatAdminDate(workOrder.intakeDate) }}</TableCell>
          <TableCell>
            <WorkOrderFlagBadges :flags="workOrder.flags" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
