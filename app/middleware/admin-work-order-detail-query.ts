import { normalizeAdminWorkOrderDetailRouteQuery } from '~/utils/admin-work-orders';

export default defineNuxtRouteMiddleware((to) => {
  const normalized = normalizeAdminWorkOrderDetailRouteQuery(to.query);

  if (!normalized.needsReplace) {
    return;
  }

  return navigateTo(
    {
      hash: to.hash,
      path: to.path,
      query: normalized.canonicalQuery,
    },
    {
      replace: true,
    },
  );
});
