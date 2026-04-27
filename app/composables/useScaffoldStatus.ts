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
      state: 'ready',
      detail: 'Admin session, customer lookup, and work-order API handlers are in place.',
    },
    {
      label: 'Frontend styling',
      state: 'ready',
      detail: 'Tailwind CSS and shadcn-vue are the active UI foundation.',
    },
    {
      label: 'Supabase schema',
      state: 'ready',
      detail: 'Initial migration, local config, and seed placeholder are in place.',
    },
    {
      label: 'Print Agent',
      state: 'pending',
      detail: 'Print job API and Python Print Agent are still pending.',
    },
  ];
}
