<script setup lang="ts">
useHead({
  title: 'BoardsReborn',
  meta: [
    {
      name: 'description',
      content: 'BoardsReborn Nuxt app scaffold.',
    },
  ],
});

const statusItems = useScaffoldStatus();
</script>

<template>
  <div class="min-h-svh bg-background">
    <section
      class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8"
      aria-labelledby="page-title"
    >
      <div class="max-w-3xl">
        <Badge variant="secondary">BoardsReborn</Badge>
        <h1
          id="page-title"
          class="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          Repair workflow foundation
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          Nuxt 4, Supabase schema, admin APIs, login/session flow, Tailwind CSS, and shadcn-vue are
          ready for the next admin frontend screens.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <Button as-child>
            <NuxtLink to="/login">登入管理端</NuxtLink>
          </Button>
          <Button as-child variant="outline">
            <NuxtLink to="/admin">前往 Admin</NuxtLink>
          </Button>
        </div>
      </div>

      <ScaffoldStatus :items="statusItems" />
    </section>
  </div>
</template>
