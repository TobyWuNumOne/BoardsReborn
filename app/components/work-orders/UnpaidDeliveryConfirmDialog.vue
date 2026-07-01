<script setup lang="ts">
withDefaults(
  defineProps<{
    isSubmitting?: boolean;
    open: boolean;
    unpaidCount?: number;
  }>(),
  {
    isSubmitting: false,
    unpaidCount: 1,
  },
);

const emit = defineEmits<{
  markPaidAndDeliver: [];
  proceedWithoutPayment: [];
  'update:open': [open: boolean];
}>();

const handleOpenChange = (open: boolean) => {
  emit('update:open', open);
};
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{
            unpaidCount > 1
              ? `${unpaidCount} 筆工單尚未標記付款，仍要交件嗎？`
              : '此工單尚未標記付款，仍要交件嗎？'
          }}
        </DialogTitle>
        <DialogDescription>
          可以先標記付款再交件，或直接標記交件；兩個動作會分開記錄。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex-col gap-2 sm:flex-col sm:items-stretch">
        <Button
          type="button"
          class="border-red-600 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600/30 dark:bg-red-600 dark:hover:bg-red-500 dark:active:bg-red-700"
          :disabled="isSubmitting"
          @click="$emit('markPaidAndDeliver')"
        >
          先標記付款並交件
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="isSubmitting"
          @click="$emit('proceedWithoutPayment')"
        >
          仍然交件
        </Button>
        <Button
          type="button"
          variant="ghost"
          :disabled="isSubmitting"
          @click="$emit('update:open', false)"
        >
          取消
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
