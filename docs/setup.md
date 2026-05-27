# Setup Guide

This document is the authoritative reference for local development setup, toolchain version baseline, environment variables, and project commands.

---

## Frontend Toolchain Version Baseline

The scaffold has been verified against the following versions:

| Item               | Version / Rule                              | Notes                                                              |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------ |
| Node.js            | `>=20.19.0`, verified locally at `v20.19.3` | Node 22 not required at this time.                                 |
| pnpm               | `10.13.1`                                   | `packageManager` field is pinned to this version.                  |
| Nuxt               | `4.1.1`                                     | Version pinned to avoid newer dependency chains requiring Node 22. |
| Nitro / Nitropack  | `2.12.6`                                    | Pinned via `pnpm.overrides`.                                       |
| H3                 | `1.15.11`                                   | Used directly in server API helpers.                               |
| Nuxt CLI           | `3.28.0`                                    | Pinned via `pnpm.overrides` to avoid peer dependency warnings.     |
| Vue                | `3.5.32`                                    | Locked by lockfile.                                                |
| Vue Router         | `4.6.4`                                     | Locked by lockfile.                                                |
| TypeScript         | `5.9.3`                                     | Locked by lockfile.                                                |
| Tailwind CSS       | `4.x`                                       | Integrated via `@tailwindcss/vite`.                                |
| shadcn-vue         | CLI-generated components                    | `components/ui` uses CLI-generated primitives.                     |
| shadcn-nuxt        | `2.x`                                       | Enables shadcn-vue component auto-import.                          |
| `@nuxtjs/supabase` | `2.0.5`                                     | Pinned to enable server helpers and DB types alias.                |
| `@nuxt/eslint`     | `1.15.2`                                    | Nuxt flat ESLint config.                                           |
| `@nuxt/test-utils` | `3.23.0`                                    | Nuxt test utilities module.                                        |
| Vitest             | `3.2.4`                                     | Locked by lockfile.                                                |
| ESLint             | `9.39.4`                                    | Locked by lockfile.                                                |
| Prettier           | `3.8.3`                                     | Formatting config in `.prettierrc`.                                |

Actual installed resolutions are governed by `package.json` and `pnpm-lock.yaml`. This document does not enumerate every shadcn-vue runtime dependency lockfile version. When upgrading Nuxt, Nitro, Node, Tailwind, shadcn packages, or formatting tools, update this table, re-run `pnpm install`, and at minimum run `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`.

---

## Local Development

### First-time setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Development server runs at:

```
http://localhost:3000
```

若要用 production preview 檢查本機 admin UI，請先跑：

```bash
pnpm build
pnpm preview
```

`pnpm build` 目前會在 build 後自動修正 Nitro `node-server` output 的 public asset link，並把 client chunks 內對 `#entry` 的引用改寫成實際 entry asset，避免 `pnpm preview` 或 `node .output/server/index.mjs` 在本機出現 `/_nuxt/*` `500` 或 Safari `Importing a module script failed`。

The `@nuxtjs/supabase` module is always enabled so that server API helpers and the Supabase Database types alias are available at build time. If Supabase URL / client key are not configured, a module warning will appear, but actual connections require filling in `.env` or the deployment environment. See [docs/progress.md](progress.md) for current implementation status. Confirm the Supabase CLI and Docker daemon are available before running Supabase commands.

---

## Supabase Local Config

This repo includes Supabase local config, baseline migrations, and a seed placeholder. Install the Supabase CLI and verify Docker is running first, then:

```bash
supabase start
supabase db reset
```

`supabase db reset` applies all `supabase/migrations/*.sql` files and runs `supabase/seed.sql`. The first seed does not include real admin credentials — create the first internal user manually via the Supabase Auth dashboard, CLI, or SQL in both local and production environments, then create the corresponding `admin_profiles` row.

After Supabase starts locally, use `supabase status` to find the API URL and anon key and populate `.env`:

```
SUPABASE_URL=<api_url>
SUPABASE_ANON_KEY=<anon_key>
```

`SUPABASE_SERVICE_ROLE_KEY` must use the service role key. It is for Nitro server API use only — never pass it to public runtime config or client code.

### Regenerate TypeScript Database types after schema changes

```bash
pnpm dlx supabase@2.93.0 gen types typescript --local > types/database.types.ts
```

---

## Environment Variables

Set these in `.env` or in the deployment platform environment. The repo is compatible with the Supabase / Vercel integration naming conventions and also supports legacy alias fallbacks.

| Variable                        | Purpose                                                                    | Browser-safe |
| ------------------------------- | -------------------------------------------------------------------------- | ------------ |
| `SUPABASE_URL`                  | Supabase project URL                                                       | Yes          |
| `SUPABASE_ANON_KEY`             | Publishable / anon key for client and authenticated requests               | Yes          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only elevated key — Nitro server API use only                       | No           |
| `NEXT_PUBLIC_SUPABASE_URL`      | Vercel / Next-style public URL alias; overrides `SUPABASE_URL`             | Yes          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel / Next-style public client key alias; overrides `SUPABASE_ANON_KEY` | Yes          |
| `NUXT_PUBLIC_APP_URL`           | Public app URL; falls back to Vercel deployment URL if unset               | Yes          |
| `ADMIN_EMAIL`                   | Used when seeding or manually creating the first admin account             | No           |
| `ADMIN_PASSWORD`                | Used when seeding or manually creating the first admin account             | No           |
| `PRINT_WORKER_TOKEN`            | Bearer token for Print Worker → Nuxt API calls                             | No           |

Legacy aliases still supported:

- `SUPABASE_KEY`
- `SUPABASE_SECRET_KEY`
- `PRINT_AGENT_TOKEN`

`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` must never be passed to the client, appear in public runtime config, or be written to logs. `PRINT_WORKER_TOKEN` must remain server-side and within the Print Worker environment only. `PRINT_AGENT_TOKEN` is kept only as a temporary legacy alias.

### `printer-worker` connectivity worker

Repo 內包含 `/printer-worker` Python 子專案，用來驗證 Raspberry Pi / local machine 是否能成功呼叫既有 print-worker API。

```bash
cd printer-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python worker.py run-once
```

詳細設定與 smoke test 流程見 `printer-worker/README.md`。

---

## Project Commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm test
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
```

Supabase CLI commands:

```bash
supabase start
supabase migration new <name>
supabase db reset
supabase db push
```

---

## Migration / Seed / Test

- Schema source of truth: `supabase/migrations/*.sql`
- Seed source of truth: `supabase/seed.sql`
- All new or modified tables, enums, RLS policies, and indexes require a migration.
- Rebuild the local database with `supabase db reset` — this applies migrations and runs the seed.
- Tests must cover: domain rules, API contract, status history append behavior, customer lookup restrictions, barcode bulk-update behavior, and print job create / claim / retry / success / fail behavior.

---

## Staging Deployment

Staging uses a ~90% semi-automated flow: manually create a Supabase staging project and store secrets, then use the CLI to link Supabase, push migrations, configure Vercel env vars, and deploy to a staging URL. For the full runbook, env variable names, and smoke test checklist, see [docs/deployment.md](deployment.md).

---

## External References

- [Nuxt Supabase module](https://nuxt.com/modules/supabase)
- [Supabase Nuxt quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nuxtjs)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/getting-started)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
