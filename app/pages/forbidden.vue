<script setup lang="ts">
useHead({
  title: 'Forbidden | BoardsReborn',
});

const adminSession = useAdminSession();

const sessionSnapshot = await adminSession.refreshAdminSession();

if (sessionSnapshot.status === 'anonymous') {
  await navigateTo('/login');
}

if (sessionSnapshot.status === 'admin') {
  await navigateTo('/admin');
}

const handleLogout = async () => {
  await adminSession.signOut();
  await navigateTo('/login');
};
</script>

<template>
  <div class="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
    <Card class="w-full max-w-md" aria-labelledby="forbidden-title">
      <CardHeader>
        <Badge variant="secondary" class="w-fit">BoardsReborn Admin</Badge>
        <CardTitle id="forbidden-title" class="text-2xl">禁止存取</CardTitle>
        <CardDescription>
          這個帳號已登入，但目前沒有對應的 admin_profiles 權限，無法進入管理端。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertTitle>需要管理端權限</AlertTitle>
          <AlertDescription>
            請確認 Supabase Auth 使用者已建立對應的 admin_profiles row。
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button variant="outline" type="button" @click="handleLogout">Logout</Button>
      </CardFooter>
    </Card>
  </div>
</template>
