import { normalizeAdminWorkOrderListRouteQuery } from '~/utils/admin-work-orders';

export default defineNuxtRouteMiddleware((to) => {
  const { canonicalQuery, needsReplace } = normalizeAdminWorkOrderListRouteQuery(to.query);

  if (!needsReplace) {
    return undefined;
  }

  return navigateTo(
    {
      path: to.path,
      query: canonicalQuery,
    },
    {
      replace: true,
    },
  );
});
