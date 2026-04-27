import tailwindcss from '@tailwindcss/vite';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const publicAppUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000';
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

  modules: ['@nuxt/eslint', '@nuxt/test-utils/module', '@nuxtjs/supabase', 'shadcn-nuxt'],

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
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
    printAgentToken: process.env.PRINT_AGENT_TOKEN || '',
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    public: {
      appUrl: publicAppUrl,
    },
  },

  supabase: {
    url: supabaseUrl,
    key: supabaseKey,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    redirect: false,
    cookieOptions: {
      secure: supabaseCookieSecure,
    },
    types: '~~/types/database.types.ts',
  },
});
