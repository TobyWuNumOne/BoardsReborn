import { getAdminRouteGuardRedirect } from '~/utils/admin-session';

export default defineNuxtRouteMiddleware(async (to) => {
  const adminSession = useAdminSession();
  const sessionSnapshot = await adminSession.refreshAdminSession();
  const redirectTarget = getAdminRouteGuardRedirect(sessionSnapshot.status, to.fullPath);

  if (redirectTarget) {
    return navigateTo(redirectTarget);
  }

  return undefined;
});
