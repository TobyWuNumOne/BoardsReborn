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
    label: 'Frontend pages',
    value: 'Next',
    detail: '下一步接 dashboard data、工單列表、詳情與建單表單。',
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
            目前這裡是 auth-aware placeholder。Tailwind CSS、shadcn-vue、sidebar layout
            已就緒，實際工單資料頁會在下一個 task 串接。
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
        <CardDescription>這些入口先固定版位；工單頁面會在後續 task 實作。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" disabled class="justify-start">工單列表（下一步）</Button>
          <Button variant="outline" disabled class="justify-start">新增工單（後續）</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
