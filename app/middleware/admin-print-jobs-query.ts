import { normalizeAdminPrintJobListRouteQuery } from '~/utils/admin-printing';

export default defineNuxtRouteMiddleware((to) => {
  const { canonicalQuery, needsReplace } = normalizeAdminPrintJobListRouteQuery(to.query);

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
