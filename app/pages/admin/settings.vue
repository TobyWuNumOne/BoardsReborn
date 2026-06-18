<script setup lang="ts">
import { FlaskConicalIcon, PlusIcon } from 'lucide-vue-next';

definePageMeta({
  layout: 'admin',
  middleware: ['admin-auth'],
});

useHead({
  title: '後台設定 | BoardsReborn',
});
</script>

<template>
  <div class="flex w-full max-w-5xl flex-col gap-6">
    <div class="space-y-2">
      <Badge variant="secondary" class="w-fit">Settings</Badge>
      <h1 class="text-2xl font-semibold tracking-tight">後台設定</h1>
    </div>

    <Card>
      <CardHeader>
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <FlaskConicalIcon class="size-5" />
          </div>
          <div class="space-y-1.5">
            <CardTitle>測試工單</CardTitle>
            <CardDescription>
              建立 99 開頭的真實測試工單，會進入一般列表、狀態與列印流程。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button as-child>
          <NuxtLink to="/admin/work-orders/new?mode=test">
            <PlusIcon data-icon="inline-start" />
            新增測試工單
          </NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
