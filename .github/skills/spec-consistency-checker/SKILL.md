---
name: spec-consistency-checker
description: 'Use when changing schema, migrations, API contract, product scope, workflow rules, README or AGENTS current-state notes, or implementation status in BoardsReborn. Verifies required sync across domain-model, api-contract, product, ai-dev-rules, barcode-printing, README, AGENTS, and docs/progress.md.'
argument-hint: 'What changed, or which files need a consistency check?'
---

# Spec Consistency Checker

Use this skill before and after changes that can desynchronize the BoardsReborn specs, implementation-status notes, or task guidance. It verifies both spec sync and progress sync.

## When to Use

- Schema, enum, RLS, index, or migration changes
- API behavior, auth, request / response, or error-model changes
- MVP scope, workflow, barcode, or printing changes
- README, AGENTS, or task-template updates that describe current repo status
- Review or pre-PR checks where you need to confirm docs stayed aligned

## Quick Mapping

| Change type | Required checks |
| --- | --- |
| Schema, enum, RLS, index | [ai-dev-rules.md](../../../docs/ai-dev-rules.md), [domain-model.md](../../../docs/domain-model.md), migration file, and [api-contract.md](../../../docs/api-contract.md) if API-facing |
| API behavior or auth | [ai-dev-rules.md](../../../docs/ai-dev-rules.md), [api-contract.md](../../../docs/api-contract.md), and [domain-model.md](../../../docs/domain-model.md) if fields or enums changed |
| Scope or workflow | [product.md](../../../docs/product.md), [ai-dev-rules.md](../../../docs/ai-dev-rules.md), and [barcode-printing.md](../../../docs/barcode-printing.md) if print or barcode-related |
| Tooling baseline or repo status | [progress.md](../../../docs/progress.md) first, then short summary checks in [README.md](../../../README.md) and [AGENTS.md](../../../AGENTS.md) |
| Print jobs or customer lookup | [barcode-printing.md](../../../docs/barcode-printing.md), [api-contract.md](../../../docs/api-contract.md), [ai-dev-rules.md](../../../docs/ai-dev-rules.md), and [domain-model.md](../../../docs/domain-model.md) if schema changed |

## Procedure

1. Classify the change.
   - Decide whether it affects schema, API, scope / workflow, printing, tooling baseline, or current implementation status.

2. Load the authoritative files.
   - Always start with [ai-dev-rules.md](../../../docs/ai-dev-rules.md).
   - Read [progress.md](../../../docs/progress.md) before making changes that affect implemented / pending work, milestones, onboarding notes, or repo-status summaries.
   - Load the matching spec files:
     - Schema, enum, status rules: [domain-model.md](../../../docs/domain-model.md)
     - API, auth, error model: [api-contract.md](../../../docs/api-contract.md)
     - MVP scope, workflow: [product.md](../../../docs/product.md)
     - Barcode, print flow: [barcode-printing.md](../../../docs/barcode-printing.md)

3. Run pre-change checks.
   - Confirm which files must be updated together.
   - Confirm whether a Supabase migration is required.
   - Note the current milestone, next steps, and risks from [progress.md](../../../docs/progress.md).
   - Do not assume `supabase/config.toml`, migrations, seed data, product API handlers, auth flows, or print-agent code already exist unless the repo actually contains them.

4. Implement the change.
   - Update the minimum set of files required by the task.
   - Keep detailed implementation-status descriptions centralized in [progress.md](../../../docs/progress.md) rather than duplicating them elsewhere.

5. Run post-change consistency checks.
   - Schema, enum, RLS, index:
     - A matching migration exists when required.
     - [domain-model.md](../../../docs/domain-model.md) matches the new schema.
     - [api-contract.md](../../../docs/api-contract.md) is updated if the change is API-facing.
   - API, auth, error model:
     - [api-contract.md](../../../docs/api-contract.md) matches request, response, auth, pagination, and error behavior.
     - [domain-model.md](../../../docs/domain-model.md) matches any changed fields or enums.
   - Scope, workflow, printing:
     - [product.md](../../../docs/product.md), [barcode-printing.md](../../../docs/barcode-printing.md), and [ai-dev-rules.md](../../../docs/ai-dev-rules.md) do not contradict each other.
   - Repo status or tooling baseline:
     - [progress.md](../../../docs/progress.md) reflects the new milestone state, completed work, next steps, or risks.
     - [README.md](../../../README.md), [AGENTS.md](../../../AGENTS.md), and task guidance only keep short summaries and point back to [progress.md](../../../docs/progress.md) for detailed current state.

6. Run the progress sync check.
   - If the task changed what is implemented, pending, blocked, or next, update [progress.md](../../../docs/progress.md) before considering the work done.
   - If no progress update was needed, state that explicitly in the completion summary.

7. Write the completion report.
   - Include docs updated, migration impact, API contract impact, progress update, and remaining risks or open questions.
   - If the task needs a structured report, follow [task-template.md](../../../docs/task-template.md).

## Escalate When

- Two authoritative docs disagree and the task does not define which one should win.
- A migration is required but the task does not allow schema changes.
- README, AGENTS, or another file still needs detailed current-state notes that cannot be replaced by a short link to [progress.md](../../../docs/progress.md).
