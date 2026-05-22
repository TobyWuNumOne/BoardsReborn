<script setup lang="ts">
import type { Database } from '../../../types/database.types';
import {
  getPrintJobStatusLabel,
  getPrintJobStatusTone,
} from '~/utils/admin-printing';
import PrintStatusLight from '~/components/printing/PrintStatusLight.vue';

defineProps<{
  status: Database['public']['Enums']['print_job_status'];
}>();
</script>

<template>
  <Badge variant="secondary" class="inline-flex items-center gap-2 rounded-full px-2.5 py-1">
    <PrintStatusLight :tone="getPrintJobStatusTone(status)" />
    <span>{{ getPrintJobStatusLabel(status) }}</span>
  </Badge>
</template>
