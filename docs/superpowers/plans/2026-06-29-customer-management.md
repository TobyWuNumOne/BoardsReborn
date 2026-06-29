# Customer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin customer management with searchable customer list, customer detail/edit, LINE management, and single work-order transfer.

**Architecture:** Add a dedicated admin customer read model and explicit Nitro API endpoints instead of expanding the create-flow customer lookup. Keep mutations server-only through existing admin context and user-scoped Supabase patterns. Frontend adds two customer-centered admin routes and reuses existing shadcn UI patterns.

**Tech Stack:** Nuxt 4, Nitro server routes, Supabase Postgres migrations/RLS/grants, TypeScript, Vue 3, Tailwind CSS v4, shadcn-vue, Vitest.

---

## File Structure

- Create `supabase/migrations/20260629173000_admin_customer_management.sql`
  - Adds `admin_customer_list` read model.
  - Adds RPCs for `transfer_admin_work_order_customer` and customer-scoped LINE token issue if direct table updates are not enough.
  - Grants authenticated admin access consistently with existing admin views/functions.
- Create `server/utils/admin-customers.ts`
  - Owns customer list/detail/update mapping, safe LINE summaries, and work-order transfer wrapper.
- Modify `server/utils/work-order-validation.ts`
  - Adds query/body parsers for customer list/detail work-order pagination, customer update, line status filter, and transfer body.
- Modify `server/utils/admin-line-bindings.ts`
  - Adds customer-scoped bind-token issuance helper while reusing existing token utilities and errors.
- Create server routes:
  - `server/api/admin/customers/index.get.ts`
  - `server/api/admin/customers/[id].get.ts`
  - `server/api/admin/customers/[id].patch.ts`
  - `server/api/admin/customers/[id]/line-bind-token.post.ts`
  - `server/api/admin/work-orders/[id]/transfer-customer.post.ts`
- Create `app/utils/admin-customers.ts`
  - Frontend types, labels, route query builders, validation helpers.
- Create Vue pages:
  - `app/pages/admin/customers/index.vue`
  - `app/pages/admin/customers/[id].vue`
- Modify navigation where current admin nav is defined.
- Modify docs:
  - `docs/product.md`
  - `docs/domain-model.md`
  - `docs/api-contract.md`
  - `docs/frontend.md`
  - `docs/progress.md`
- Modify tests:
  - `tests/unit/supabase-migration.test.ts`
  - `tests/unit/work-order-api.test.ts`
  - `tests/unit/admin-line-api.test.ts`
  - Add `tests/unit/admin-customers-api.test.ts`
  - Add or extend frontend page tests for admin customers.

## Task 1: Migration And Database Contracts

**Files:**
- Create: `supabase/migrations/20260629173000_admin_customer_management.sql`
- Modify: `tests/unit/supabase-migration.test.ts`

- [ ] **Step 1: Write migration guard tests**

Add tests that read the new migration and assert:

```ts
expect(adminCustomerManagementMigration).toContain('create or replace view public.admin_customer_list');
expect(adminCustomerManagementMigration).toContain('work_order_count');
expect(adminCustomerManagementMigration).toContain('active_work_order_count');
expect(adminCustomerManagementMigration).toContain('latest_work_order_id');
expect(adminCustomerManagementMigration).toContain('line_notify_status');
expect(adminCustomerManagementMigration).toContain('grant select on table public.admin_customer_list to authenticated');
expect(adminCustomerManagementMigration).toContain('create or replace function public.transfer_admin_work_order_customer');
expect(adminCustomerManagementMigration).toContain('grant execute on function public.transfer_admin_work_order_customer(uuid, uuid) to authenticated');
```

- [ ] **Step 2: Run migration guard test and verify it fails**

Run: `pnpm vitest run tests/unit/supabase-migration.test.ts`

Expected: FAIL because `20260629173000_admin_customer_management.sql` does not exist yet.

- [ ] **Step 3: Add migration**

Create `admin_customer_list` with safe fields only:

```sql
create or replace view public.admin_customer_list as
select
  customers.id,
  customers.name,
  customers.phone,
  customers.normalized_phone,
  customers.note,
  customers.created_at,
  customers.updated_at,
  count(work_orders.id)::integer as work_order_count,
  count(work_orders.id) filter (
    where work_orders.current_status not in ('DELIVERED', 'CANCELLED')
  )::integer as active_work_order_count,
  latest_work_order.id as latest_work_order_id,
  latest_work_order.paper_order_no as latest_paper_order_no,
  latest_work_order.current_status as latest_work_order_status,
  latest_work_order.updated_at as latest_work_order_updated_at,
  customer_line_accounts.id is not null as line_linked,
  customer_line_accounts.display_name as line_display_name,
  customer_line_accounts.picture_url as line_picture_url,
  customer_line_accounts.is_friend as line_is_friend,
  customer_line_accounts.blocked_at as line_blocked_at,
  customer_line_accounts.friendship_checked_at as line_friendship_checked_at,
  case
    when customer_line_accounts.id is null then 'unlinked'
    when customer_line_accounts.blocked_at is not null then 'not_notifyable'
    when customer_line_accounts.is_friend is true then 'notifyable'
    else 'unknown'
  end as line_notify_status
from public.customers
left join public.work_orders on work_orders.customer_id = customers.id
left join lateral (
  select id, paper_order_no, current_status, updated_at
  from public.work_orders latest
  where latest.customer_id = customers.id
  order by latest.updated_at desc
  limit 1
) latest_work_order on true
left join public.customer_line_accounts on customer_line_accounts.customer_id = customers.id
group by
  customers.id,
  customer_line_accounts.id,
  latest_work_order.id,
  latest_work_order.paper_order_no,
  latest_work_order.current_status,
  latest_work_order.updated_at;

grant select on table public.admin_customer_list to authenticated;
```

Add `transfer_admin_work_order_customer(p_work_order_id uuid, p_target_customer_id uuid)`:

```sql
create or replace function public.transfer_admin_work_order_customer(
  p_work_order_id uuid,
  p_target_customer_id uuid
)
returns table (
  work_order_id uuid,
  previous_customer_id uuid,
  target_customer_id uuid,
  transferred_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_customer_id uuid;
begin
  select customer_id
  into v_previous_customer_id
  from public.work_orders
  where id = p_work_order_id
  for update;

  if v_previous_customer_id is null then
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;

  perform 1 from public.customers where id = p_target_customer_id;
  if not found then
    raise exception 'Target customer not found' using errcode = 'P0002';
  end if;

  if v_previous_customer_id = p_target_customer_id then
    raise exception 'Target customer must be different' using errcode = '23514';
  end if;

  update public.work_orders
  set customer_id = p_target_customer_id,
      updated_at = now()
  where id = p_work_order_id;

  return query
  select p_work_order_id, v_previous_customer_id, p_target_customer_id, now();
end;
$$;

grant execute on function public.transfer_admin_work_order_customer(uuid, uuid) to authenticated;
```

- [ ] **Step 4: Run migration tests**

Run: `pnpm vitest run tests/unit/supabase-migration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260629173000_admin_customer_management.sql tests/unit/supabase-migration.test.ts
git commit -m "feat(db): add admin customer management read model"
```

## Task 2: Backend Validation And Customer API Utilities

**Files:**
- Modify: `server/utils/work-order-validation.ts`
- Create: `server/utils/admin-customers.ts`
- Test: `tests/unit/admin-customers-api.test.ts`

- [ ] **Step 1: Write validation tests**

Create tests for:

```ts
expect(parseAdminCustomerListQuery({ q: '0912', page: '2', lineStatus: 'linked' })).toMatchObject({
  q: '0912',
  page: 2,
  lineStatus: 'linked',
});
expect(() => parseAdminCustomerListQuery({ lineStatus: 'bad' })).toThrow();
expect(parseAdminCustomerUpdateBody({ name: '王小明', phone: '0912-345-678', note: '' })).toEqual({
  name: '王小明',
  phone: '0912345678',
  note: null,
});
expect(() => parseAdminCustomerUpdateBody({ name: '王小明', phone: '02-1234-5678' })).toThrow();
expect(parseWorkOrderTransferCustomerBody({ targetCustomerId: 'ddf3e1b0-1c86-41a9-a22c-a40231ecf981' })).toEqual({
  targetCustomerId: 'ddf3e1b0-1c86-41a9-a22c-a40231ecf981',
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/unit/admin-customers-api.test.ts`

Expected: FAIL because parsers do not exist.

- [ ] **Step 3: Add parsers**

Add exported types and functions:

```ts
export type AdminCustomerLineStatusFilter = 'all' | 'linked' | 'unlinked' | 'not_notifyable';

export interface AdminCustomerListQuery {
  q?: string;
  lineStatus: AdminCustomerLineStatusFilter;
  page: number;
  pageSize: number;
  sort: string;
}

export interface AdminCustomerUpdateBody {
  name: string;
  phone: string;
  note: string | null;
}

export interface WorkOrderTransferCustomerBody {
  targetCustomerId: string;
}
```

Use existing validation helpers in `work-order-validation.ts` for UUID, page/pageSize, unknown-field rejection, trimming, and phone normalization.

- [ ] **Step 4: Add API utility mapping tests**

Mock a Supabase-like client and test:

- `listAdminCustomers()` queries `admin_customer_list`, applies `q`, applies `lineStatus`, and returns `{ data, pageInfo }`.
- `getAdminCustomerDetail()` returns customer profile, LINE summary, and work orders.
- `updateAdminCustomer()` updates only `name`, `phone`, `note`.
- `transferAdminWorkOrderCustomer()` calls `transfer_admin_work_order_customer` and maps same-customer constraint to validation error.

- [ ] **Step 5: Implement `server/utils/admin-customers.ts`**

Implement:

```ts
export const listAdminCustomers = async (supabase: UserScopedSupabaseClient, query: AdminCustomerListQuery) => { /* map view rows */ };
export const getAdminCustomerDetail = async (supabase: UserScopedSupabaseClient, id: string, query: { page: number; pageSize: number }) => { /* customer + line + work orders */ };
export const updateAdminCustomer = async (supabase: UserScopedSupabaseClient, id: string, body: AdminCustomerUpdateBody) => { /* update customers */ };
export const transferAdminWorkOrderCustomer = async (supabase: UserScopedSupabaseClient, workOrderId: string, targetCustomerId: string) => { /* rpc wrapper */ };
```

Keep LINE summaries safe: do not return `line_user_id`, token hashes, recipients, or prepared messages.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/admin-customers-api.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/utils/work-order-validation.ts server/utils/admin-customers.ts tests/unit/admin-customers-api.test.ts
git commit -m "feat(api): add admin customer service helpers"
```

## Task 3: Backend Routes And LINE Customer Token Endpoint

**Files:**
- Create routes under `server/api/admin/customers/`
- Create: `server/api/admin/work-orders/[id]/transfer-customer.post.ts`
- Modify: `server/utils/admin-line-bindings.ts`
- Test: `tests/unit/admin-line-api.test.ts`

- [ ] **Step 1: Write route source tests**

Extend tests to assert route files exist and contain:

```ts
expect(routeSource).toContain('requireAdminContext');
expect(routeSource).toContain('defineApiHandler');
expect(routeSource).toContain('parseAdminCustomerListQuery');
expect(routeSource).toContain('listAdminCustomers');
```

For transfer route:

```ts
expect(routeSource).toContain('parseWorkOrderTransferCustomerBody');
expect(routeSource).toContain('transferAdminWorkOrderCustomer');
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/unit/admin-customers-api.test.ts tests/unit/admin-line-api.test.ts`

Expected: FAIL because route files and helper are missing.

- [ ] **Step 3: Add customer routes**

Implement routes with existing pattern:

```ts
export default defineApiHandler(async (event) => {
  const { supabase } = await requireAdminContext(event);
  const query = parseAdminCustomerListQuery(getQuery(event));
  return listAdminCustomers(supabase, query);
});
```

Use `readBody(event)` for PATCH and POST bodies. Use `getRouterParam(event, 'id')` for ids.

- [ ] **Step 4: Add customer-scoped LINE token helper**

In `server/utils/admin-line-bindings.ts`, add:

```ts
export const issueAdminCustomerLineBindToken = async (
  supabase: UserScopedSupabaseClient,
  input: { customerId: string; userId: string },
  config: LineBindTokenConfig,
) => { /* reject active binding, issue token for latest/customer context */ };
```

If the existing RPC requires a work order, choose the latest work order for the customer only when needed for token context. If no work order exists, return `404 NOT_FOUND` or a clear conflict, then document that first version requires at least one customer work order for a printable bind card.

- [ ] **Step 5: Add `POST /api/admin/customers/{id}/line-bind-token`**

Route body is `{}` only; unknown fields return validation error. It returns `{ data: { id, expiresAt, liffUrl, revokedTokenCount } }`.

- [ ] **Step 6: Add transfer route**

`POST /api/admin/work-orders/{id}/transfer-customer` reads `targetCustomerId`, calls utility, and returns transfer summary.

- [ ] **Step 7: Run route/helper tests**

Run: `pnpm vitest run tests/unit/admin-customers-api.test.ts tests/unit/admin-line-api.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/api/admin/customers server/api/admin/work-orders/[id]/transfer-customer.post.ts server/utils/admin-line-bindings.ts tests/unit/admin-customers-api.test.ts tests/unit/admin-line-api.test.ts
git commit -m "feat(api): add admin customer endpoints"
```

## Task 4: Frontend Customer List

**Files:**
- Create: `app/utils/admin-customers.ts`
- Create: `app/pages/admin/customers/index.vue`
- Modify: admin navigation component/file
- Test: frontend unit test file matching existing page tests

- [ ] **Step 1: Write frontend utility tests**

Test route query parsing and LINE labels:

```ts
expect(parseAdminCustomerListRouteQuery({ q: '王', lineStatus: 'linked', page: '2' })).toMatchObject({
  q: '王',
  lineStatus: 'linked',
  page: 2,
});
expect(getCustomerLineStatusLabel({ linked: true, notifyStatus: 'notifyable' })).toBe('已綁定，可通知');
expect(getCustomerLineStatusLabel({ linked: false, notifyStatus: 'unlinked' })).toBe('未綁定');
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/unit/admin-customers-ui.test.ts`

Expected: FAIL because utility/page does not exist.

- [ ] **Step 3: Implement frontend utility**

Create types for customer list rows and helpers:

```ts
export type AdminCustomerLineStatusFilter = 'all' | 'linked' | 'unlinked' | 'not_notifyable';
export const CUSTOMER_LINE_STATUS_FILTERS = ['all', 'linked', 'unlinked', 'not_notifyable'] as const;
export const getCustomerLineStatusLabel = (line: AdminCustomerLineSummary) => { /* labels */ };
```

- [ ] **Step 4: Build `/admin/customers`**

Use existing app page style:

- Header with title `顧客管理`.
- Search input for phone/name/note.
- Select or segmented buttons for LINE status filter.
- Native table with columns from spec.
- Row click navigates to `/admin/customers/${id}`.
- Pagination uses existing pagination components or the same pattern as `/admin/work-orders`.

- [ ] **Step 5: Add nav entry**

Add `顧客` to admin sidebar/navigation near `工單`.

- [ ] **Step 6: Run frontend tests**

Run: `pnpm vitest run tests/unit/admin-customers-ui.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/utils/admin-customers.ts app/pages/admin/customers/index.vue app/components tests/unit/admin-customers-ui.test.ts
git commit -m "feat(frontend): add admin customer list"
```

## Task 5: Frontend Customer Detail, Edit, LINE, Transfer

**Files:**
- Create: `app/pages/admin/customers/[id].vue`
- Modify/Create small customer components if needed.
- Test: `tests/unit/admin-customers-ui.test.ts`

- [ ] **Step 1: Write detail UI tests**

Assert source contains:

```ts
expect(pageSource).toContain('/api/admin/customers/');
expect(pageSource).toContain('顧客資料');
expect(pageSource).toContain('LINE 管理');
expect(pageSource).toContain('轉移工單');
expect(pageSource).toContain('/transfer-customer');
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run tests/unit/admin-customers-ui.test.ts`

Expected: FAIL because detail page is missing.

- [ ] **Step 3: Implement detail page**

Build cards:

- Profile read/edit card for `name`, `phone`, `note`.
- LINE card with status, issue token button, unlink button, confirmation dialog.
- Work-order table with link to work-order detail and transfer button.
- Transfer dialog with target customer lookup using existing `/api/admin/customers? q=...` or a focused lookup query.

- [ ] **Step 4: Implement mutations**

Use `$fetch` with existing request fetch helper:

- `PATCH /api/admin/customers/{id}`
- `POST /api/admin/customers/{id}/line-bind-token`
- `DELETE /api/admin/customers/{id}/line-binding`
- `POST /api/admin/work-orders/{id}/transfer-customer`

After success, refetch detail. Do not keep stale transferred work order in the source customer list.

- [ ] **Step 5: Run UI tests**

Run: `pnpm vitest run tests/unit/admin-customers-ui.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/pages/admin/customers/[id].vue tests/unit/admin-customers-ui.test.ts
git commit -m "feat(frontend): add admin customer detail"
```

## Task 6: Documentation Sync

**Files:**
- Modify: `docs/product.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/frontend.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: Update product scope**

Document that customer management first version is included:

- searchable customer list
- customer detail/edit
- LINE management from customer page
- single-work-order transfer
- no customer deletion, no customer merge, no bulk transfer

- [ ] **Step 2: Update domain model**

Document:

- `admin_customer_list` read model.
- `transfer_admin_work_order_customer` behavior.
- LINE binding remains customer-level.

- [ ] **Step 3: Update API contract**

Add contracts for:

- `GET /api/admin/customers`
- `GET /api/admin/customers/{id}`
- `PATCH /api/admin/customers/{id}`
- `POST /api/admin/customers/{id}/line-bind-token`
- `POST /api/admin/work-orders/{id}/transfer-customer`

- [ ] **Step 4: Update frontend guide**

Add routes:

- `/admin/customers`
- `/admin/customers/[id]`

Document list/detail layout and confirmation rules.

- [ ] **Step 5: Update progress**

Set last updated date to `2026-06-29` and add current implemented customer management status.

- [ ] **Step 6: Run spec consistency checks**

Run:

```bash
pnpm vitest run tests/unit/supabase-migration.test.ts tests/unit/admin-customers-api.test.ts tests/unit/admin-customers-ui.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/product.md docs/domain-model.md docs/api-contract.md docs/frontend.md docs/progress.md
git commit -m "docs: document customer management"
```

## Task 7: Full Verification

**Files:**
- No planned source changes unless verification finds bugs.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
pnpm vitest run tests/unit/admin-customers-api.test.ts tests/unit/admin-customers-ui.test.ts tests/unit/admin-line-api.test.ts tests/unit/public-work-order-lookup.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run migration guard**

Run:

```bash
pnpm vitest run tests/unit/supabase-migration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck/lint**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run full test suite if time permits**

Run:

```bash
pnpm test
```

Expected: PASS or report exact failures.

- [ ] **Step 5: Final status**

Run:

```bash
git status --short
```

Expected: clean worktree after commits, or only intentional uncommitted changes if user asked not to commit.

## Self-Review

- Spec coverage: customer list, detail, update, LINE status/actions, single transfer, no deletion, no merge, no bulk transfer, docs, and tests are covered.
- Placeholder scan: no `TBD` or `TODO` placeholders are intentionally present.
- Type consistency: customer line status uses `linked`, `unlinked`, `notifyable`, `not_notifyable`, and `unknown`; API filter uses `all`, `linked`, `unlinked`, `not_notifyable`.
