export type ScaffoldStatusState = 'ready' | 'pending';

export interface ScaffoldStatusItem {
  label: string;
  state: ScaffoldStatusState;
  detail: string;
}

export function useScaffoldStatus(): ScaffoldStatusItem[] {
  return [
    {
      label: 'Nuxt app',
      state: 'ready',
      detail: 'app, pages, layouts, components, composables are in place.',
    },
    {
      label: 'Tooling',
      state: 'ready',
      detail: 'pnpm scripts, ESLint flat config, TypeScript, and Vitest are configured.',
    },
    {
      label: 'Server API',
      state: 'pending',
      detail: 'server/api exists, but product endpoints have not been implemented yet.',
    },
    {
      label: 'Supabase schema',
      state: 'ready',
      detail: 'Initial migration, local config, and seed placeholder are in place.',
    },
  ];
}
