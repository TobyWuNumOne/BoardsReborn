import { normalizeAdminCustomerDetailRouteQuery } from '~/utils/admin-customers';

export default defineNuxtRouteMiddleware((to) => {
  const normalized = normalizeAdminCustomerDetailRouteQuery(to.query);

  if (!normalized.needsReplace) {
    return undefined;
  }

  return navigateTo(
    {
      path: to.path,
      query: normalized.canonicalQuery,
    },
    {
      replace: true,
    },
  );
});
