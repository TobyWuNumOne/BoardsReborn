<script setup lang="ts">
import {
  getPrintDeviceConnectionStateLabel,
  getPrintDeviceConnectionStateTone,
  type PrintDeviceConnectionState,
} from '~/utils/admin-printing';
import PrintStatusLight from '~/components/printing/PrintStatusLight.vue';

defineProps<{
  state: PrintDeviceConnectionState;
}>();
</script>

<template>
  <Badge variant="secondary" class="inline-flex items-center gap-2 rounded-full px-2.5 py-1">
    <PrintStatusLight :tone="getPrintDeviceConnectionStateTone(state)" />
    <span>{{ getPrintDeviceConnectionStateLabel(state) }}</span>
  </Badge>
</template>
