export type ScaffoldStatusState = 'ready' | 'pending'

export interface ScaffoldStatusItem {
  label: string
  state: ScaffoldStatusState
  detail: string
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
      state: 'pending',
      detail: 'No migrations or seed data have been added in this scaffold task.',
    },
  ]
}
