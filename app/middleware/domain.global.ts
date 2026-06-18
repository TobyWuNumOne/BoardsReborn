import { resolveDomainRedirect } from '~/utils/domain-routing';

export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig();
  const requestOrigin = import.meta.client ? window.location.origin : useRequestURL().origin;
  const currentUrl = new URL(to.fullPath, requestOrigin).toString();
  const redirect = resolveDomainRedirect({
    adminUrl: config.public.adminUrl,
    currentUrl,
    statusUrl: config.public.statusUrl,
  });

  if (!redirect) {
    return undefined;
  }

  return navigateTo(redirect.location, {
    external: redirect.external,
    redirectCode: redirect.redirectCode,
  });
});
