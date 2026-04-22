<script setup lang="ts">
import type { ScaffoldStatusItem } from '~/composables/useScaffoldStatus';

defineProps<{
  items: ScaffoldStatusItem[];
}>();
</script>

<template>
  <section class="status-section" aria-labelledby="status-heading">
    <div class="section-heading">
      <p class="section-kicker">Project State</p>
      <h2 id="status-heading">Scaffold baseline</h2>
    </div>

    <div class="status-grid">
      <article
        v-for="item in items"
        :key="item.label"
        class="status-card"
        :class="`status-card--${item.state}`"
      >
        <div class="status-card__header">
          <h3>{{ item.label }}</h3>
          <span class="status-pill">{{ item.state }}</span>
        </div>
        <p>{{ item.detail }}</p>
      </article>
    </div>
  </section>
</template>
