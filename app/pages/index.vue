<script setup lang="ts">
useHead({
  title: 'BoardsReborn',
  meta: [
    {
      name: 'description',
      content: 'BoardsReborn Nuxt scaffold.',
    },
  ],
})

const statusItems = useScaffoldStatus()
</script>

<template>
  <div class="home-page">
    <section class="hero-section" aria-labelledby="page-title">
      <p class="eyebrow">
        BoardsReborn
      </p>
      <h1 id="page-title">
        Repair workflow foundation
      </h1>
      <p class="hero-copy">
        Nuxt 4 is ready for the work-order app. Database migrations, product API handlers, and print-agent flows are still intentionally outside this scaffold.
      </p>
    </section>

    <ScaffoldStatus :items="statusItems" />
  </div>
</template>
