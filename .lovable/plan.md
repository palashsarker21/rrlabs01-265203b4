
# Phase 1 — Billing Audit + Success Fee Engine

Scope locked by user answers:
- Complete Phase 1 only. Phases 2–15 → prioritized roadmap in the Launch Report.
- Success fee model: monthly Lemon Squeezy invoice (usage-based add-on).
- Launch-ready bar: Billing + Monitoring + Legal green; rest tracked.

No schema changes to existing tables, no auth changes, no RLS rewrites. New tables only for success-fee bookkeeping.

## 1. Billing Audit (read-only, produces the report)

Audit against the existing code path (`src/lib/billing.functions.ts`, `src/lib/lemon-squeezy.ts`, `src/routes/api/public/webhooks/lemonsqueezy.ts`, `src/lib/billing-notifications.server.ts`, `src/lib/billing-summary.functions.ts`). Verify each lifecycle event maps correctly and flag defects. Fixes limited to defects found — no rewrites.

Coverage matrix:

```text
Checkout create           createCheckoutSession                    verify + fix if broken
Trial start               subscription_created (on_trial)          verify
Active → past_due         subscription_payment_failed              verify (event override present)
past_due → active         subscription_payment_success (recover)   verify (notif fires)
Upgrade / Downgrade       subscription_updated (variant change)    ADD: reconcile plan_id from ls_variant_id
Cancel                    subscription_cancelled                   FIX: cancelled_at set unconditionally on every update
Resume                    subscription_resumed / _unpaused         verify
Expired                   subscription_expired                     verify
Paused                    subscription_paused                      verify
Refund                    order_refunded (currently no-op)         ADD: record billing_events + notify
Webhook signature         HMAC-SHA256 x-signature                  verify (timingSafeEqual OK)
Idempotency               billing_events.event_id                  verify (unique on provider,event_id)
Env vars                  billing-env.ts assertBillingEnv          verify all 4 variants declared
```

Known defects to fix in this pass:
- `onSubscriptionUpdated` sets `cancelled_at = now()` on every update where `attr.cancelled` is truthy — collapses to always-now on repeated events. Guard: only set on transition into `cancelled`/`expired` when not already set.
- Upgrade/downgrade doesn't remap `plan_id` — if the customer changes plan in LS, our `subscriptions.plan_id` stays stale. Look up the new plan by `ls_variant_id` and update.
- `order_refunded` isn't dispatched — add handler that writes `billing_events` and notifies the workspace (no reversal of workspace state; refunds are read-only accounting).

## 2. Success Fee Engine (new)

New tables, no changes to existing ones.

```text
success_fee_statements     one row per workspace per calendar month
  workspace_id, period_start, period_end, currency,
  recovered_amount_cents, fee_bps, fee_amount_cents,
  status (draft|finalized|invoiced|paid|voided),
  ls_invoice_id, ls_checkout_url, provider_error, provider_status_code,
  finalized_at, invoiced_at, paid_at,
  UNIQUE (workspace_id, period_start)

success_fee_adjustments    manual credits/debits by super_admin
  statement_id, kind (credit|debit|refund|manual),
  amount_cents, reason, actor_user_id
```

Flow:

```text
[monthly cron] → build draft statements for previous month
   ↓ aggregate recovery_events WHERE status='recovered'
                AND recovered_at within [period_start, period_end)
   ↓ fee = round(sum(amount_cents) * plan.success_fee_bps / 10_000)
[super_admin review] → apply adjustments → finalize
   ↓
[invoice job] → create LS one-time checkout for the workspace's billing email,
                custom_price = fee - sum(adjustments), attach statement_id
   ↓
[webhook order_created / order_refunded] → mark statement invoiced/paid/voided
```

Lemon Squeezy piece:
- Requires ONE new "pay-as-you-go" LS variant (single one-time product used for all workspaces; the price is passed at checkout-create via `custom_price`).
- Secret name: `LEMONSQUEEZY_VARIANT_SUCCESS_FEE` (already documented; will be requested via `add_secret` if missing).
- Uses existing `createHmac` + webhook route — extend dispatch to link `order_created` to a statement via `custom_data.statement_id`.

Server functions (all `requireSupabaseAuth` + super_admin gate, except the workspace-owner viewer):
- `listSuccessFeeStatements({ workspaceId? })` — statements list (super_admin sees all; owners see own).
- `getSuccessFeeStatement({ id })` — full detail incl. adjustments.
- `addSuccessFeeAdjustment({ statementId, kind, amount_cents, reason })` — super_admin only.
- `finalizeSuccessFeeStatement({ id })` — locks draft → finalized.
- `issueSuccessFeeInvoice({ id })` — creates LS one-time checkout, stores `ls_invoice_id` + `ls_checkout_url`.
- `runMonthlySuccessFeeBuild({ period? })` — idempotent draft-builder (called by cron and manual admin button).
- `exportSuccessFeeCsv({ from, to, workspaceId? })` — CSV export.

Cron endpoint:
- `POST /api/public/hooks/success-fee-monthly` — protected by `CRON_SECRET` bearer header (existing pattern in `recovery-cadence.ts`). Calls `runMonthlySuccessFeeBuild` for the previous month.

Customer-visible surface (small — the full Portal is Phase 2, deferred):
- New "Success fee" section in existing `BillingPanel` (reuses component) showing current-month recovered revenue + accrued fee, last finalized statement, and (if invoiced) an "Open invoice" link. Uses existing tokens; no new colors/fonts.
- New route: `_authenticated/billing.statements.tsx` — read-only list of workspace's statements with drill-down and PDF/CSV download (reuses existing export helpers from events page).

Admin surface (super_admin):
- New panel `SuccessFeePanel` inside existing `src/components/admin/panels.tsx`. Lists all statements with filters (period, workspace, status), row actions: Adjust, Finalize, Issue invoice, Void. Reuses `DataTable`, `ConfirmDialog`.

Audit trail:
- Every mutation writes to existing `audit_logs` via the existing tg_audit_workspace_change trigger by tagging `workspace_id` on new tables.

## 3. Production Launch Report

Written to `.lovable/production-launch-report.md` at end of pass:

```text
PHASE 1  Billing + Success Fee    ✅ | ⚠ | ❌ per checklist item
PHASE 3  Monitoring               status of Sentry/health/alerts already shipped
PHASE 15 Legal & compliance       status of existing legal pages

Deferred (owner + priority):
  P2  Customer Billing Portal expansion
  P4  OpenAPI / Swagger UI
  P5  Help Center
  P6  Visual campaign builder
  P7  AI Recommendations
  P8  Customer timeline
  P9  Audit Center expansion
  P10 Public status page
  P11 Admin console expansion
  P12 Blog CMS finish
  P13 Public docs
  P14 Backup & DR

Risk register  |  Security assessment  |  Billing readiness
Launch-ready:  YES only if Phase 1 checklist has no ❌ and no critical ⚠
```

## Files touched

New:
- `supabase/migrations/<ts>_success_fee_engine.sql`
- `src/lib/success-fee.functions.ts`
- `src/lib/success-fee/engine.server.ts` (aggregation + invoice creation)
- `src/routes/api/public/hooks/success-fee-monthly.ts`
- `src/routes/_authenticated/billing.statements.tsx`
- `src/components/admin/success-fee-panel.tsx`
- `.lovable/production-launch-report.md`

Edited:
- `src/routes/api/public/webhooks/lemonsqueezy.ts` — fix `cancelled_at` guard, plan_id reconcile on variant change, dispatch `order_created`/`order_refunded` to link statements.
- `src/components/billing/billing-panel.tsx` — add "Success fee" block (reuses existing card layout).
- `src/components/admin/panels.tsx` — mount `SuccessFeePanel`.
- `src/lib/billing-env.ts` — declare `LEMONSQUEEZY_VARIANT_SUCCESS_FEE`.

Not touched: auth, RLS on existing tables, existing subscription flow, `src/integrations/supabase/*` autogen, pricing.ts business logic.

## Prerequisites I need from you

1. In Lemon Squeezy: create ONE "Success fee" pay-what-you-owe variant (single one-time product, price left blank — we pass `custom_price` per invoice). Reply with the variant ID and I'll store it as `LEMONSQUEEZY_VARIANT_SUCCESS_FEE` via the secrets tool.
2. Confirm the calendar-month settlement window is UTC (default) or a specific tz.

Once (1) is in and you approve this plan, I'll ship it end-to-end and produce the Launch Report.
