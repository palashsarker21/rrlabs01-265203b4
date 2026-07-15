# RRLabs Billing System — Production Audit

Audit date: 2026-07-15
Provider: Lemon Squeezy (single-provider)
Model: SSOT for display = `src/lib/pricing.ts`; SSOT for checkout = `plans` DB rows.

Legend: ✅ PASS · ⚠️ WARNING · ❌ FAIL

## 1. Lemon Squeezy checkout

| Item | Status | Notes |
|---|---|---|
| Hosted checkout creation | ✅ | `createCheckoutSession` builds `/v1/checkouts` with variant + custom_data + redirect. |
| Overlay / embed | ⚠️ | `embed:false` — redirect flow only. Fine for prod; upgrade to embed later if desired. |
| Per-plan variant resolution | ✅ | Env override (`LEMONSQUEEZY_VARIANT_<CODE>`) → DB `ls_variant_id`. |
| Missing variant → "Coming Soon" | ✅ | `has_variant=false` disables CTA; server also rejects checkout. |
| Enterprise gated | ✅ | `is_contact_sales` → routes to `/contact-sales`. |
| Checkout session persisted | ✅ | `checkout_sessions` row created **before** LS call; webhook reconciles it. |
| Trial included | ✅ | Controlled by LS variant (`trial_days` mirrored in DB for display). |

## 2. Webhooks (`/api/public/webhooks/lemonsqueezy`)

| Event | Handled | Idempotent | Updates DB |
|---|---|---|---|
| `subscription_created` | ✅ | ✅ unique `(provider,event_id)` + upsert on `ls_subscription_id` | subscriptions + workspaces + checkout_sessions |
| `subscription_updated` | ✅ | ✅ | subscription + workspace status |
| `subscription_cancelled` | ✅ | ✅ | sets `cancelled_at`, workspace→cancelled |
| `subscription_resumed` | ✅ | ✅ | status transitions |
| `subscription_expired` | ✅ | ✅ | workspace→cancelled |
| `subscription_paused` | ✅ | ✅ | workspace→suspended |
| `subscription_unpaused` | ✅ | ✅ | reactivates |
| `subscription_payment_success` | ✅ | ✅ | refreshes renews_at |
| `subscription_payment_failed` | ✅ | ✅ | past_due → workspace suspended, engine off |
| `order_created` | ✅ (recorded) | ✅ | no-op; kept for audit |
| `license_created` | ⚠️ | — | Not used by RRLabs (SaaS, not license keys). Ignored safely. |
| HMAC signature verified | ✅ | timingSafeEqual + length check |
| 5xx retry semantics | ✅ | Handler failure returns 500 → LS retries |

## 3. Database

| Table | Status | Indexes / FKs |
|---|---|---|
| `plans` | ✅ | 4 canonical rows; `is_active`, `is_contact_sales`, `success_fee_bps`, `starting_at_price_cents`, `ls_variant_id`. Unique per `code`. |
| `subscriptions` | ✅ | unique(`ls_subscription_id`); idx status, workspace; FK plan (SET NULL), workspace (CASCADE). |
| `billing_events` | ✅ | unique(`provider`,`event_id`) provides webhook idempotency; idx workspace; FK sub (SET NULL). |
| `checkout_sessions` | ✅ | tracks pending → fulfilled workspace. |
| `contact_leads` | ✅ | Enterprise inquiries. |

## 4. Workspace sync

Every subscription state change updates `workspaces.subscription_status`, `subscription_id`, and — on cancel/expire/pause — flips `status` to `cancelled|suspended` and disables the recovery engine. `trial_ends_at` mirrored on create. ✅

## 5. Dashboard billing surface

| Item | Status | Notes |
|---|---|---|
| Current plan display | ✅ | New `BillingPanel` on `/app`. |
| Trial countdown | ✅ | Existing `TrialBadge` + reminder banner. |
| Renewal date | ✅ | Shown in `BillingPanel`. |
| Payment method (card last 4) | ✅ | Shown in `BillingPanel`. |
| Upgrade CTA | ✅ | Routes to `/upgrade`. |
| Manage Billing button | ✅ | Opens `customer_portal_url` (LS-hosted portal). |
| Invoices | ⚠️ | Delegated to Lemon Squeezy customer portal (industry standard). |
| Usage vs. plan limits | ⚠️ | Recovery-events count shown; hard limit enforcement is future work. |

## 6. Customer portal

`subscriptions.customer_portal_url` captured from LS webhook attributes → surfaced as **Manage Billing** on the dashboard. ✅

## 7. Failed payments

- `subscription_payment_failed` → `status='past_due'` on subscription; workspace suspended; recovery engine off. ✅
- Retry cadence handled by Lemon Squeezy (dunning built-in). ✅
- Update-payment-method URL surfaced in `BillingPanel` when past_due. ✅
- In-app notification: ⚠️ owner-email notification via existing lifecycle emails is TODO; toast + panel banner shipped.

## 8. Environment variables

Loud validation added in `src/lib/billing-env.ts`. Required for full billing:

- `LEMONSQUEEZY_API_KEY` ✅
- `LEMONSQUEEZY_STORE_ID` ✅
- `LEMONSQUEEZY_WEBHOOK_SECRET` ✅
- `LEMONSQUEEZY_VARIANT_STARTER` ✅
- `LEMONSQUEEZY_VARIANT_GROWTH` ✅
- `LEMONSQUEEZY_VARIANT_BUSINESS` ✅
- `LEMONSQUEEZY_VARIANT_SCALE` (deprecated, retained) ⚠️

## 9. Admin (super admin metrics)

`getBillingMetrics` server fn (super-admin only) reports:

- Active subscriptions
- Trials
- Cancelled (last 30d)
- MRR (sum of active plan `price_cents`, normalized to monthly)
- ARR (MRR × 12)
- Trial→paid conversion rate (last 90d)
- Recovered revenue (sum of `recovery_events` where `status='recovered'`)

## 10. Overall checklist

| Area | Status |
|---|---|
| Checkout end-to-end | ✅ |
| Webhook coverage + idempotency | ✅ |
| DB integrity (FK/indexes/uniques) | ✅ |
| Workspace sync | ✅ |
| Dashboard visibility | ✅ (new panel) |
| Customer portal link | ✅ |
| Failed-payment handling | ✅ (in-product; email notification TODO) |
| Env validation | ✅ |
| Admin metrics | ✅ |
| Invoices | ⚠️ delegated to LS portal |
| Usage limit enforcement | ⚠️ future |
