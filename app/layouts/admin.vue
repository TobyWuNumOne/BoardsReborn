<script setup lang="ts">
import { ClipboardListIcon, HomeIcon, Layers3Icon, LogOutIcon } from 'lucide-vue-next';

const adminSession = useAdminSession();
const route = useRoute();

await adminSession.refreshAdminSession();

const displayName = computed(() => adminSession.profile.value?.displayName || 'Admin');

const navItems = [
  {
    label: '首頁',
    to: '/admin',
    icon: HomeIcon,
    enabled: true,
  },
  {
    label: '工單列表',
    to: '/admin/work-orders',
    icon: ClipboardListIcon,
    enabled: true,
  },
  {
    label: '批量狀態',
    to: '/admin/work-orders/bulk-status',
    icon: Layers3Icon,
    enabled: true,
  },
];

const handleLogout = async () => {
  await adminSession.signOut();
  await navigateTo('/login');
};
</script>

<template>
  <div
    v-if="adminSession.status.value === 'loading'"
    class="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10"
  >
    <Card class="w-full max-w-md">
      <CardHeader>
        <Badge variant="secondary" class="w-fit">BoardsReborn Admin</Badge>
        <CardTitle>Loading session</CardTitle>
        <CardDescription>正在確認管理端登入狀態。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Checking admin session
        </div>
      </CardContent>
    </Card>
  </div>

  <SidebarProvider v-else-if="adminSession.status.value === 'admin'">
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div class="flex items-center gap-2 px-2 py-1.5">
          <div
            class="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"
            aria-hidden="true"
          >
            BR
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">BoardsReborn</p>
            <p class="truncate text-xs text-muted-foreground">Admin workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="item in navItems" :key="item.to">
                <SidebarMenuButton
                  v-if="item.enabled"
                  as-child
                  :is-active="route.path === item.to"
                  :tooltip="item.label"
                >
                  <NuxtLink :to="item.to">
                    <component :is="item.icon" />
                    <span>{{ item.label }}</span>
                  </NuxtLink>
                </SidebarMenuButton>

                <SidebarMenuButton v-else disabled :tooltip="`${item.label}：待實作`">
                  <component :is="item.icon" />
                  <span>{{ item.label }}</span>
                  <SidebarMenuBadge>soon</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <div class="flex flex-col gap-2 p-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{{ displayName }}</p>
            <p class="truncate text-xs text-muted-foreground">已登入管理端</p>
          </div>
          <Button variant="outline" size="sm" type="button" class="w-full" @click="handleLogout">
            <LogOutIcon data-icon="inline-start" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset>
      <header
        class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <SidebarTrigger />
        <Separator orientation="vertical" class="h-5" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">BoardsReborn Admin</p>
          <p class="truncate text-xs text-muted-foreground">Session ready</p>
        </div>
      </header>

      <main class="flex-1 p-4 sm:p-6">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>

  <div v-else class="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
    <Card class="w-full max-w-md">
      <CardHeader>
        <Badge variant="secondary" class="w-fit">BoardsReborn Admin</Badge>
        <CardTitle>Redirecting</CardTitle>
        <CardDescription>登入狀態已變更，正在重新導向。</CardDescription>
      </CardHeader>
    </Card>
  </div>
</template>
