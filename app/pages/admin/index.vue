<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: 'Admin Workspace | BoardsReborn',
});

const summaryCards = [
  {
    label: 'Admin session',
    value: 'Ready',
    detail: '登入、session bootstrap、route guard 與 logout action 已可用。',
  },
  {
    label: 'Work-order API',
    value: 'Ready',
    detail: 'Create/list/detail/update/status/resolve/bulk-status 已在 server API 層完成。',
  },
  {
    label: 'Work-order list',
    value: 'Ready',
    detail: '工單列表已可查詢、篩選、排序與分頁；詳情與建單仍在後續 task。',
  },
];
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Dashboard</Badge>
      <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">管理端工作區</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            目前 dashboard 仍是 auth-aware placeholder，但工單列表已可從左側導覽進入。接下來會補
            dashboard live data、工單詳情與建單流程。
          </p>
        </div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <Card v-for="card in summaryCards" :key="card.label" data-size="sm">
        <CardHeader>
          <CardDescription>{{ card.label }}</CardDescription>
          <CardTitle class="text-2xl">{{ card.value }}</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm leading-6 text-muted-foreground">{{ card.detail }}</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Quick entries</CardTitle>
        <CardDescription>先保留最常用入口；工單列表已可直接進入。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid gap-3 sm:grid-cols-2">
          <Button as-child variant="outline" class="justify-start">
            <NuxtLink to="/admin/work-orders">工單列表</NuxtLink>
          </Button>
          <Button variant="outline" disabled class="justify-start">新增工單（後續）</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
