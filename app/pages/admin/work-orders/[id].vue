<script setup lang="ts">
const route = useRoute();

definePageMeta({
  layout: 'admin',
  middleware: 'admin-auth',
});

useHead({
  title: '工單詳情 | BoardsReborn',
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <Badge variant="secondary" class="w-fit">Work order detail</Badge>
      <h1 class="text-2xl font-semibold tracking-tight">工單詳情頁待實作</h1>
      <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
        F3 先把工單列表接通。這裡暫時保留 route placeholder，後續 detail task
        會接上實際資料與狀態操作。
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>目前工單 ID</CardTitle>
        <CardDescription>{{ route.params.id }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child type="button" variant="outline">
          <NuxtLink to="/admin/work-orders">返回工單列表</NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
