# BoardsReborn Agent Guide

## Project State

- The authoritative source for current implementation status, completed milestones, and next steps is [docs/progress.md](docs/progress.md).
- This repository combines documentation-first specs with a minimal Nuxt scaffold; do not present planned product implementation details as if they are already built.
- Supabase local config, migrations, seed placeholder, generated Database types, server API foundation helpers, admin customer lookup, and admin work-order create/list/detail/update/status/resolve/bulk-status handlers exist; login/session UI and print-agent implementation are still pending.

## Read First

- Use [docs/progress.md](docs/progress.md) for the current repo state, milestone progress, and next steps.
- Start with [docs/ai-dev-rules.md](docs/ai-dev-rules.md). Its rules are binding.
- Use [docs/product.md](docs/product.md) for MVP scope, user flows, and out-of-scope features.
- Use [docs/domain-model.md](docs/domain-model.md) for schema, enums, status rules, and storage boundaries.
- Use [docs/api-contract.md](docs/api-contract.md) for endpoint shapes, auth, pagination, and error format.
- Use [docs/barcode-printing.md](docs/barcode-printing.md) for barcode payload, async print jobs, and Print Agent responsibilities.
- Use [docs/task-template.md](docs/task-template.md) when a task needs explicit acceptance criteria or completion-report structure.

## Agent Behavior Rules

- Treat this guide and the linked docs as the source of truth. Do not infer product behavior from incomplete code when the docs define the intended behavior.
- Think before coding: identify the smallest verifiable goal, relevant docs, affected files, and assumptions before editing.
- Prefer simple implementation over speculative architecture. Do not add abstractions, utilities, dependencies, background workers, roles, endpoints, tables, or flows unless the task explicitly requires them.
- Make surgical changes. Touch only files required for the task, and do not reformat, rename, reorganize, or opportunistically refactor unrelated code.
- State uncertainty instead of guessing. If schema, API contract, runtime behavior, or product intent is unclear, inspect the relevant docs/code first; if still unclear, surface the assumption in the completion report.
- Convert every task into verifiable outcomes. Bug fixes should include a reproduction path or failing test when practical; new behavior should include success and failure checks.
- Preserve existing conventions. Match established naming, validation style, error shape, folder structure, composable/server helper usage, and test patterns.
- Do not claim work is complete unless validation was performed or the exact validation gap is reported.

## Progress Workflow

- Before changing code or docs, read [docs/progress.md](docs/progress.md) to confirm the current phase, completed work, next steps, and open risks.
- After finishing a change, revisit [docs/progress.md](docs/progress.md) and update any affected milestone status, completed items, next steps, blockers, or last-updated date.
- A task that changes what is implemented, pending, or blocked is not complete until the relevant progress update is written to [docs/progress.md](docs/progress.md).
- If a change affects schema, API, scope, workflow, tooling baseline, or current implementation status, use [spec-consistency-checker](.github/skills/spec-consistency-checker/SKILL.md) as part of the verification.
- If another file needs to mention current repo status, keep it brief and point to [docs/progress.md](docs/progress.md) instead of duplicating detailed state.

## Required Sync Rules

- Any schema, enum, RLS, or index change must include a Supabase migration and a matching update to [docs/domain-model.md](docs/domain-model.md).
- Any API behavior, request, response, auth, or error-model change must update [docs/api-contract.md](docs/api-contract.md).
- Any MVP scope or workflow change must update [docs/product.md](docs/product.md).
- If a task changes core engineering rules, update [docs/ai-dev-rules.md](docs/ai-dev-rules.md) in the same work.

## Validation Expectations

- For API changes, verify request validation, success response shape, error envelope, auth/admin behavior, and pagination/filter/sort behavior when applicable.
- For status changes, verify `status_history` append behavior, `work_orders.current_status` synchronization, illegal `SNOWBOARD -> DRYING` rejection, and timestamp side effects.
- For print-related changes, verify `print_jobs` lifecycle behavior and do not treat `SENT_TO_PRINTER` as physical print confirmation.
- For docs-only changes, verify cross-document consistency rather than running irrelevant app tests.
- If tests or commands cannot be run, explain the reason and provide the most specific manual verification path.

## Project-Specific Non-Negotiables

- Barcode payload is always `paper_order_no`. Do not introduce a second primary barcode identifier.
- Status changes must append to `status_history`. `work_orders.current_status` is only the latest-status cache.
- `SNOWBOARD` must not transition to `DRYING`.
- Entering `READY_FOR_PICKUP`, `DELIVERED`, or `CANCELLED` must also maintain the corresponding timestamp fields.
- Print is asynchronous through `print_jobs` plus a Python Print Agent. Reprints create new `print_jobs` records.
- `SENT_TO_PRINTER` means transport succeeded, not that a label was physically printed.
- Customer progress lookup must go through server API validation with paper order number and phone last four digits. A wrong `phoneLast4` should return `404`.
- Never expose `SUPABASE_SECRET_KEY` or `PRINT_AGENT_TOKEN` to client code, public runtime config, logs, or responses.
- Nuxt is the main app and API layer. It is not the USB printer driver layer.
- Work order creation RPCs should contain core work-order data only unless a task explicitly expands their responsibility; print-job creation remains a separate retryable flow.
- Bulk work-order operations should process each target independently unless the task explicitly requires all-or-nothing transaction behavior.
- Unknown request fields must be rejected when the relevant API contract defines strict validation.
- Admin endpoints must use the established admin context and user-scoped Supabase client pattern. Do not introduce service-role fallback unless explicitly requested.
- Do not introduce payment state, inventory, rental, consignment, multi-store, accounting, or board-level repair-history features into MVP work.

## Working Style For This Repo

- Prefer updating specs or creating the minimum required project files over inventing nonexistent implementation details.
- Before running commands such as `pnpm dev` or `supabase start`, confirm the required project files and local tools actually exist.
- Current frontend toolchain baseline is documented in [README.md](README.md); keep it synchronized when changing Node, pnpm, Nuxt, Nitro, Vue, TypeScript, ESLint, Prettier, or Vitest versions.
- All list APIs must support filter, sort, and pagination, return `{ data, pageInfo }`, and use the shared error envelope defined in [docs/api-contract.md](docs/api-contract.md).
- When finishing a task or PR, report changes, tests, migration impact, API contract impact, and open risks. Follow [docs/task-template.md](docs/task-template.md) when useful.

## Completion Report Format

When finishing implementation work, report:

- Changed files and why.
- Behavior added, changed, or intentionally left unchanged.
- Tests or checks run, including failures.
- Migration impact.
- API contract impact.
- Docs updated or intentionally not updated.
- Open risks, assumptions, or follow-up tasks.
