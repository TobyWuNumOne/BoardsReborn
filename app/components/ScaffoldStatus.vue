<script setup lang="ts">
import type { ScaffoldStatusItem } from '~/composables/useScaffoldStatus';

defineProps<{
  items: ScaffoldStatusItem[];
}>();

const badgeVariantByState: Record<ScaffoldStatusItem['state'], 'default' | 'secondary'> = {
  ready: 'default',
  pending: 'secondary',
};
</script>

<template>
  <section class="border-t pt-8" aria-labelledby="status-heading">
    <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-medium text-muted-foreground">Project State</p>
        <h2 id="status-heading" class="text-xl font-semibold tracking-tight">Scaffold baseline</h2>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Card v-for="item in items" :key="item.label" data-size="sm">
        <CardHeader>
          <CardTitle>{{ item.label }}</CardTitle>
          <CardAction>
            <Badge :variant="badgeVariantByState[item.state]">{{ item.state }}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-6 text-muted-foreground">{{ item.detail }}</p>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
