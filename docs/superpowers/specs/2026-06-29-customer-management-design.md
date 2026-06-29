# Customer Management Design

Date: 2026-06-29
Status: Draft for user review

## Context

BoardsReborn already has first-class `customers`, `work_orders`, `customer_line_accounts`, `line_bind_tokens`, and `line_jobs` data models. Current admin UI only exposes customer lookup inside work-order creation and LINE status/actions inside a work-order detail card. There is no standalone customer management area.

This design adds a customer-centered admin workflow while preserving the current MVP boundaries:

- Admin can search and inspect customers directly.
- Admin can update customer identity/contact fields.
- Admin can see LINE binding state and run existing merchant-controlled LINE actions from a customer page.
- Admin can transfer one work order from one customer to another.
- Admin cannot delete customers.
- Admin cannot merge customers.

## Goals

- Add `/admin/customers` as the main customer management entry.
- Add `/admin/customers/[id]` as the customer detail page.
- Show whether a customer has an active LINE binding and whether that binding is currently notifyable.
- Show how many work orders belong to a customer and list those work orders on the detail page.
- Allow editing customer name, phone, and internal note.
- Allow merchant-side LINE unlink and LINE bind-token issuance from the customer page.
- Allow transferring exactly one work order at a time to another existing customer.

## Non-Goals

- No customer deletion.
- No customer merge operation.
- No bulk work-order transfer.
- No customer self-service management.
- No customer-side LINE unlink.
- No multiple LINE accounts per customer.
- No board-level repair-history feature beyond listing work orders already linked to a customer.
- No marketing, broadcast, membership, payment, rental, inventory, or accounting features.

## Recommended Approach

Use a customer-centered route and API model:

- `/admin/customers` lists customers and exposes search/filter/pagination.
- `/admin/customers/[id]` owns customer edit, LINE management, work-order list, and single-work-order transfer actions.
- Customer list data comes from a dedicated admin read model rather than from the current create-flow lookup endpoint.
- Mutating operations use explicit API endpoints and preserve existing admin auth and user-scoped Supabase patterns.

This approach is preferred over adding more controls to work-order detail pages because the user goal is customer management, not work-order-only customer edits. It also avoids a single-page drawer design that would become cramped once LINE status and work-order transfer states are included.

## Data And API Design

### Customer List

Add `GET /api/admin/customers`.

Requirements:

- Auth: admin session through the established admin context.
- Query:
  - `q`: searches normalized phone, customer name, and customer note.
  - `lineStatus`: `all`, `linked`, `unlinked`, `not_notifyable`.
  - `page`, `pageSize`, `sort`: follows existing list API rules.
- Response uses `{ data, pageInfo }`.
- Each row includes:
  - `id`
  - `name`
  - `phone`
  - `note`
  - `createdAt`
  - `updatedAt`
  - `workOrderCount`
  - `activeWorkOrderCount`
  - `latestWorkOrder`
  - `line` summary: active binding state, display name, is friend, blocked state, notifyable status, last checked time.

Implementation should consider a database read model such as `admin_customer_list` for count and LINE aggregation. The view must use existing RLS/grant conventions and should not expose LINE user ID, token hash, recipient, prepared payload, or secrets.

### Customer Detail

Add `GET /api/admin/customers/{id}`.

Requirements:

- Auth: admin.
- Returns:
  - customer profile: `id`, `name`, `phone`, `note`, `createdAt`, `updatedAt`.
  - LINE summary using the same safe fields as the list page, plus latest pending token state if useful for admin display.
  - first page of work-order summaries for that customer, using the same `{ data, pageInfo }` pagination shape for the embedded work-order list.
- The work-order summaries include enough data to navigate and decide whether transfer is needed:
  - `id`
  - `paperOrderNo`
  - `currentStatus`
  - `boardType`
  - `boardLengthClass`
  - `boardColor`
  - `repairCount`
  - `intakeDate`
  - `updatedAt`

### Customer Update

Add `PATCH /api/admin/customers/{id}`.

Requirements:

- Auth: admin.
- Strict request body. Only these fields are accepted:
  - `name`
  - `phone`
  - `note`
- Phone uses the existing Taiwan mobile normalization rule.
- Unknown fields return `422 VALIDATION_ERROR`.
- Missing customer returns `404 NOT_FOUND`.
- Successful update returns the updated customer profile.
- Updating phone affects future public lookup validation for every work order still linked to that customer.

### Customer LINE Actions

Keep the existing merchant-only unlink endpoint:

- `DELETE /api/admin/customers/{id}/line-binding`

Add customer-scoped token issuance:

- `POST /api/admin/customers/{id}/line-bind-token`

Rules:

- Issuing a token must reject if the customer already has an active LINE binding.
- Issuing a token revokes other pending tokens for the same customer.
- The response may return a temporary LIFF URL for admin copy/print flow, but must not persist plaintext tokens to tables, logs, or print job payload.
- Unlink remains a hard delete of the current binding and revokes pending tokens, following the existing admin-only LINE rule.
- Customer-side unlink remains out of scope.

The existing work-order-scoped `POST /api/admin/work-orders/{id}/line-bind-token` can remain for work-order detail usage. The customer-scoped endpoint exists so customer management does not require choosing an arbitrary work order just to issue a card.

### Single Work-Order Transfer

Add `POST /api/admin/work-orders/{id}/transfer-customer`.

Request:

```json
{
  "targetCustomerId": "ddf3e1b0-1c86-41a9-a22c-a40231ecf981"
}
```

Requirements:

- Auth: admin.
- Strict request body.
- Transfers exactly one work order.
- Updates `work_orders.customer_id` from the current customer to the target customer.
- Missing work order returns `404 NOT_FOUND`.
- Missing target customer returns `404 NOT_FOUND`.
- Transferring to the same customer returns `422 VALIDATION_ERROR` on `targetCustomerId`.
- Existing `status_history` remains unchanged because status did not change.
- Print jobs and immutable print payload snapshots remain unchanged.
- Future admin work-order reads, public lookup phone validation, and LINE notification target selection use the new customer.
- LINE binding itself stays on the customer record; it does not move as an object separate from the target customer.

First version transfer only targets an existing customer. Creating a standalone customer outside the work-order creation flow is not part of this design.

## UI Design

### `/admin/customers`

The list page contains:

- Search input for phone, name, or note.
- LINE status filter:
  - all
  - linked
  - unlinked
  - not notifyable
- Paginated table with:
  - customer name
  - phone
  - LINE status
  - work-order count
  - latest work order
  - note summary
  - updated time

Rows navigate to `/admin/customers/[id]`.

### `/admin/customers/[id]`

The detail page contains:

- Customer profile card:
  - read mode and edit mode
  - editable fields: name, phone, note
  - save/cancel controls
- LINE management card:
  - active binding state
  - LINE display name if available
  - friend/blocked/notifyable status
  - last checked time
  - issue token action
  - unlink action with confirmation
- Work orders card:
  - list of this customer's work orders
  - link to work-order detail
  - single-work-order transfer action for each row

### Transfer Dialog

The transfer dialog:

- Opens from one work-order row.
- Shows the source customer and target work order number.
- Lets admin search for the target customer by phone/name.
- Requires explicit target selection.
- Shows a confirmation summary:
  - from customer
  - to customer
  - affected paper order number
- Submits exactly one transfer.
- Refetches source customer detail after success.
- If the transferred work order no longer belongs to the current customer, the UI removes it from the visible list.

## Error Handling

- All new endpoints use the existing error envelope with request ID.
- Validation errors use `422 VALIDATION_ERROR` and field-specific `fieldErrors`.
- Unauthorized and forbidden behavior follows existing admin API behavior.
- `not_notifyable` LINE state is informational; it does not block customer update or work-order transfer.
- LINE unlink and work-order transfer both require confirmation UI.
- LINE Messaging API accepted responses must not be described as delivered/read.

## Documentation Impact

Implementation must update:

- `docs/product.md`
  - Replace the prior "Customer detail page rework" non-goal with the approved customer management scope.
  - State that customer delete and customer merge remain out of scope.
  - State that single-work-order transfer is the supported correction workflow.
- `docs/domain-model.md`
  - Document customer management read model and work-order transfer behavior.
  - Reconfirm LINE binding belongs to customer, not to a work order.
- `docs/api-contract.md`
  - Add customers list/detail/update, customer-scoped LINE token issuance, and work-order transfer contract.
- `docs/frontend.md`
  - Add `/admin/customers` and `/admin/customers/[id]` route and UI rules.
- `docs/progress.md`
  - Update after implementation changes are complete and verified.

## Testing Plan

API tests should cover:

- Customer list pagination, sorting, and filters.
- Customer list `q` search for phone, name, and note.
- Customer detail success and not-found behavior.
- Customer update success, strict unknown-field rejection, validation errors, and phone normalization.
- Customer-scoped LINE token issuance:
  - success for unbound customer
  - rejection for already-bound customer
  - pending-token revocation behavior
- LINE unlink behavior remains merchant-only and uses existing transaction rules.
- Work-order transfer:
  - success path
  - missing work order
  - missing target customer
  - same-customer transfer behavior
  - transfer changes subsequent admin reads
  - transfer changes public lookup phone validation to the target customer's phone

Frontend tests should cover:

- Customer list search and filter state.
- Customer detail profile edit state.
- LINE card main states.
- Transfer dialog target selection and confirmation.
- Successful transfer removes or refreshes the moved work order from the source customer detail view.

## Acceptance Criteria

- Admin can open a customer list page and search by phone/name/note.
- Admin can see LINE binding status and work-order count in the list.
- Admin can open a customer detail page and see profile, LINE summary, and the customer's work orders.
- Admin can edit name, phone, and note.
- Admin can issue a LINE bind token from the customer page when the customer is not already bound.
- Admin can unlink an active LINE binding from the customer page with confirmation.
- Admin can transfer one work order to another customer with confirmation.
- Customer deletion, customer merge, and bulk transfer are absent from the UI and API.
- Documentation and tests are updated with the implementation.
