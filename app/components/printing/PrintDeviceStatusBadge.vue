<script setup lang="ts">
import type { Database } from '../../../types/database.types';
import {
  getPrintDeviceStatusLabel,
  getPrintDeviceStatusTone,
} from '~/utils/admin-printing';
import PrintStatusLight from '~/components/printing/PrintStatusLight.vue';

defineProps<{
  status: Database['public']['Enums']['print_device_status'];
}>();
</script>

<template>
  <Badge variant="secondary" class="inline-flex items-center gap-2 rounded-full px-2.5 py-1">
    <PrintStatusLight :tone="getPrintDeviceStatusTone(status)" />
    <span>{{ getPrintDeviceStatusLabel(status) }}</span>
  </Badge>
</template>
