const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseModuleEnabled = Boolean(supabaseUrl && supabaseKey);
const supabaseConfig = supabaseModuleEnabled
  ? {
      supabase: {
        url: supabaseUrl,
        key: supabaseKey,
        redirect: false,
      },
    }
  : {};

export default defineNuxtConfig({
  compatibilityDate: '2026-04-21',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    ...(supabaseModuleEnabled ? ['@nuxtjs/supabase'] : []),
  ],

  css: ['~/assets/css/main.css'],

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
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  },

  ...supabaseConfig,
});
