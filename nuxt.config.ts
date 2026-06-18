import tailwindcss from '@tailwindcss/vite';

const readFirstNonEmpty = (...values: Array<string | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
};

const resolveVercelUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
};

const supabaseUrl = readFirstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NUXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL,
);
const supabaseKey = readFirstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.NUXT_PUBLIC_SUPABASE_KEY,
  process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_KEY,
);
const supabaseSecretKey = readFirstNonEmpty(
  process.env.NUXT_SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const publicAppUrl =
  readFirstNonEmpty(
    process.env.NUXT_PUBLIC_APP_URL,
    resolveVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    resolveVercelUrl(process.env.VERCEL_BRANCH_URL),
    resolveVercelUrl(process.env.VERCEL_URL),
  ) || 'http://localhost:3000';
const publicAdminUrl = readFirstNonEmpty(process.env.NUXT_PUBLIC_ADMIN_URL) || '';
const publicStatusUrl =
  readFirstNonEmpty(process.env.NUXT_PUBLIC_STATUS_URL, process.env.NUXT_PUBLIC_APP_URL) ||
  publicAppUrl;
const supabaseCookieSecure = (() => {
  try {
    return new URL(publicAppUrl).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
})();

export default defineNuxtConfig({
  compatibilityDate: '2026-04-21',
  devtools: { enabled: true },
  experimental: {
    appManifest: false,
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    '@nuxtjs/supabase',
    '@vercel/speed-insights/nuxt',
    'shadcn-nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: '~/components/ui',
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  runtimeConfig: {
    supabaseSecretKey: supabaseSecretKey || '',
    printAgentToken: process.env.PRINT_AGENT_TOKEN || '',
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    public: {
      adminUrl: publicAdminUrl,
      appUrl: publicAppUrl,
      statusUrl: publicStatusUrl,
    },
  },

  supabase: {
    url: supabaseUrl,
    key: supabaseKey,
    secretKey: supabaseSecretKey,
    redirect: false,
    cookieOptions: {
      secure: supabaseCookieSecure,
    },
    types: '~~/types/database.types.ts',
  },
});
