import { normalizeAdminCustomerListRouteQuery } from '~/utils/admin-customers';

export default defineNuxtRouteMiddleware((to) => {
  const { canonicalQuery, needsReplace } = normalizeAdminCustomerListRouteQuery(to.query);

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
