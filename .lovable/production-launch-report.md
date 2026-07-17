# Production Launch Report — Phase 1: Billing + Success Fee

_Generated: 2026-07-17_

## Scope of this pass

Per user direction (2026-07-17), the 15-phase mega-brief was scoped down to
**Phase 1 (billing correctness + Success Fee engine)** for this cycle. All
other phases are tracked in `.lovable/plan.md` for post-launch iterations.

Bar for "launch-ready": every code path in this report is idempotent,
tested against real Lemon Squeezy variant IDs where credentials exist, and
covered by RLS + super-admin gating in the database.

---

## 1. Lemon Squeezy webhook audit — findings & fixes

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `subscriptions.cancelled_at` was overwritten on every subscription update, even when the sub was still active, producing false cancellation history and breaking retention analytics. | HIGH | **Fixed** — now only set on the transition INTO `cancelled`/`expired`, and the first timestamp is preserved. |
| 2 | Upgrade / downgrade never remapped `plan_id`. When a customer switched Growth → Scale, LS reported the new `variant_id`, but our `subscriptions.plan_id` and `plans.success_fee_bps` stayed on the old plan, undercharging every recovery. | HIGH | **Fixed** — webhook now looks up `plans.ls_variant_id` on variant change and updates `plan_id` in the same UPDATE. Persists `ls_variant_id` for auditability. |
| 3 | `order_created` was a no-op, so success-fee invoices had no way to auto-settle from LS. | HIGH | **Fixed** — new `onOrderCreated` handler links `custom_data.statement_id` to `success_fee_statements` and marks them `paid`. |
| 4 | `order_refunded` was unhandled. | MEDIUM | **Fixed** — new `onOrderRefunded` handler voids the corresponding success-fee statement and inserts a `refund` adjustment for audit. |
| 5 | LS variant discovery already handled ENV → DB → LS-store fallback (see `src/lib/lemon-squeezy.ts`). No changes needed. | — | Verified. |
| 6 | `checkout_sessions` records `provider_error` and `provider_status_code` on failure. | — | Verified via `admin.checkoutSessionsPanel`. |

**Idempotency**: LS webhook already dedupes on `billing_events.ls_event_id`
UNIQUE index; both new handlers are safe to receive the same event twice.

---

## 2. Success Fee Engine — new capability

### Data model
Migration `20260717183657_11894be0-5bca-4446-a89d-f946e1507028.sql`:

- `public.success_fee_statements` — one row per workspace × UTC calendar
  month. Columns include `recovered_amount_cents`, `events_count`, `fee_bps`,
  `fee_amount_cents`, `adjustments_total_cents`, `net_amount_cents`,
  `status` (draft → finalized → invoiced → paid / voided), and LS linkage.
  Unique on `(workspace_id, period_start, period_end)` — safe to rebuild.
- `public.success_fee_adjustments` — credits / debits / refunds / manual
  entries, each recomputes the parent statement via
  `public.recompute_success_fee_statement(uuid)` (SECURITY DEFINER).
- RLS: workspace members read their own; only `service_role` writes. Admin
  UI writes through `supabaseAdmin`.

### Server logic (`src/lib/success-fee/engine.server.ts`)
- `previousMonthBounds(now)` computes UTC month bounds deterministically.
- `buildStatementsForPeriod(period)` aggregates every `recovered` event in
  the window per workspace, uses each workspace's live plan `success_fee_bps`,
  and UPSERTs a draft statement — never touches locked (`finalized+`) rows.
- `issueInvoiceForStatement(id)` calls Lemon Squeezy `/v1/checkouts` with a
  `custom_price` equal to `net_amount_cents`, `custom_data.kind =
  "success_fee"` and `custom_data.statement_id`. Records `ls_checkout_id`,
  `ls_checkout_url`, and flips status to `invoiced`. On LS 4xx/5xx it
  persists the raw error to `provider_error` and rethrows.

### RPC entrypoint (`src/lib/success-fee.functions.ts`)
All admin mutations verify `is_super_admin(auth.uid())` before touching
`supabaseAdmin`. Customer reads (`listSuccessFeeStatements`,
`getWorkspaceSuccessFeeSummary`, `exportSuccessFeeCsv`) run through
`requireSupabaseAuth` and RLS, so a workspace member only ever sees their
own rows.

### UI surfaces
- **Customer**: `BillingPanel` gained a Success Fee block (current-month
  accrual, "pay outstanding invoice" CTA) and a dedicated page at
  `/billing/statements` (period, recovered, fee, adjustments, net, status,
  invoice link, CSV export).
- **Super-admin**: `SuccessFeePanel` under `/_authenticated/admin` → tab
  "Success fees". Aggregate KPIs, per-row Finalize / Issue invoice / Adjust
  / Void, "Build previous month" button, CSV export.

### Cron settlement
`src/routes/api/public/hooks/success-fee-monthly.ts` — POST endpoint,
guarded by an `apikey` header check against `SUPABASE_PUBLISHABLE_KEY` (the
project-standard pattern used by `recovery-cadence.ts`). Builds the previous
UTC month; safe to re-run (draft rows overwrite, locked rows skip).

**Schedule to add (via `supabase--insert` on go-live, not committed as a
migration since it holds the anon key):**

```sql
select cron.schedule(
  'success-fee-monthly-build',
  '15 3 1 * *', -- 03:15 UTC on the 1st of each month
  $$
  select net.http_post(
    url:='https://rrlabs01.lovable.app/api/public/hooks/success-fee-monthly',
    headers:='{"Content-Type": "application/json", "apikey": "<SUPABASE_PUBLISHABLE_KEY>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### Environment
Add `LEMONSQUEEZY_VARIANT_SUCCESS_FEE` to Vercel (Production + Preview) —
the LS variant configured with `custom_price=true` in the LS dashboard.
Falls back gracefully with a clear error if unset.

---

## 3. Verification checklist

- [x] `tsgo --noEmit` clean.
- [x] Webhook handlers idempotent (existing `ls_event_id` UNIQUE index).
- [x] RLS: statements and adjustments locked to workspace members (read) and
      service role (write); mutations gated by `is_super_admin`.
- [x] `cancelled_at` regression test scenario: subscribe → renew → renew →
      cancel — only the cancel transition sets the timestamp; renews leave
      it as-is.
- [x] Plan-change scenario: swap variant on LS → next `subscription_updated`
      webhook sets `subscriptions.plan_id` to the new plan.
- [ ] **Manual (super-admin)**: after first month of recovered events, run
      "Build previous month" in `/admin?tab=success_fee`, then Finalize +
      Issue invoice on one row, then confirm `order_created` webhook flips
      status to `paid`.
- [ ] **Cron**: schedule the SQL above once the endpoint is deployed to
      production.

---

## 4. Deferred to next cycle

Phases 2 – 15 of the mega-brief (customer billing portal deep-dive,
production monitoring dashboards, incident automation, blog engine
upgrades, i18n, mobile app polish, etc.) are intentionally out of scope for
this pass and remain in the plan file.
