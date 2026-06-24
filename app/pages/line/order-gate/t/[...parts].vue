<script setup lang="ts">
import { buildOrderGateUrl } from '~/utils/line-liff';
import { normalizeLineOrderGateTokenValue } from '~/utils/line-order-gate-token';

const route = useRoute();
const config = useRuntimeConfig();

useHead({
  title: 'LINE 綁定 | BoardsReborn',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const statusOrigin = () => {
  try {
    return new URL(config.public.statusUrl || window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

const routeParts = computed(() => {
  const parts = route.params.parts;
  if (Array.isArray(parts)) return parts;
  return typeof parts === 'string' ? [parts] : [];
});

const pathToken = computed(() => normalizeLineOrderGateTokenValue(routeParts.value[0]));
const debugEnabled = computed(
  () => route.query.debug === '1' || routeParts.value.includes('debug'),
);

onMounted(() => {
  const token = pathToken.value;
  if (!token) {
    window.location.replace('/line/order-gate');
    return;
  }

  window.location.replace(buildOrderGateUrl(token, debugEnabled.value, statusOrigin()));
});
</script>

<template>
  <main
    class="min-h-svh bg-[radial-gradient(circle_at_top,_oklch(0.94_0.05_190),_transparent_48%),linear-gradient(to_bottom,_white,_oklch(0.97_0.01_220))] px-4 py-8 sm:py-14"
  >
    <Card class="mx-auto max-w-xl overflow-hidden border-slate-200 shadow-xl shadow-slate-900/5">
      <div class="h-2 bg-gradient-to-r from-cyan-600 via-teal-500 to-amber-400" />
      <CardContent class="flex items-center justify-center gap-3 py-10 text-muted-foreground">
        <Spinner /> 正在開啟 LINE 綁定頁...
      </CardContent>
    </Card>
  </main>
</template>
