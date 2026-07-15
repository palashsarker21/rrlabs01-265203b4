# RRLabs Billing System — Final Production Audit

Audit date: 2026-07-15 (final production completion)
Provider: Lemon Squeezy (single-provider)
Model: SSOT for display = `src/lib/pricing.ts`; SSOT for checkout = `plans` DB rows.

Legend: ✅ PASS · ⚠️ WARNING · ❌ FAIL

## 1. Lemon Squeezy checkout

| Item | Status | Notes |
|---|---|---|
| Hosted checkout creation | ✅ | `createCheckoutSession` builds `/v1/checkouts` with variant + custom_data + redirect. |
| Overlay / embed | ⚠️ | Redirect flow only (`embed:false`); embed is a future enhancement. |
| Per-plan variant resolution | ✅ | Env override → DB `ls_variant_id`. |
| Missing variant → "Coming Soon" | ✅ | `has_variant=false` disables CTA + server rejects. |
| Enterprise gated | ✅ | Routed to `/contact-sales`. |
| Checkout session persisted | ✅ | Row created before LS call; webhook reconciles. |
| Trial included | ✅ | Controlled via LS variant. |

## 2. Webhooks

| Event | Handled | Idempotent | Notification |
|---|---|---|---|
| `subscription_created` | ✅ | ✅ | — |
| `subscription_updated` | ✅ | ✅ | — |
| `subscription_cancelled` | ✅ | ✅ | ✅ `cancellation_warning` |
| `subscription_resumed` | ✅ | ✅ | — |
| `subscription_expired` | ✅ | ✅ | ✅ `subscription_cancelled` |
| `subscription_paused` / `unpaused` | ✅ | ✅ | — |
| `subscription_payment_success` | ✅ | ✅ | ✅ `payment_recovered` (past_due → active) |
| `subscription_payment_failed` | ✅ | ✅ | ✅ `payment_failed` |
| `order_created` | ✅ | ✅ | — |
| HMAC signature | ✅ | timingSafeEqual + length check |
| 5xx retry semantics | ✅ | Handler failures return 500 → LS retries |
| Duplicate suppression | ✅ | Unique `(provider,event_id)` + short-circuit if `processed_at` set |

## 3. Usage enforcement (server-side)

| Item | Status |
|---|---|
| `plans.monthly_event_limit` column | ✅ |
| Starter=500 / Growth=2500 / Business=10000 / Enterprise=∞ | ✅ |
| Server-side gate in `ingestStripeFailure` | ✅ |
| Super-admin bypass | ✅ |
| Client cannot bypass | ✅ (frontend limits are display-only) |
| Structured error `UsageLimitError` (status 402) | ✅ |

## 4. Notifications

| Item | Status |
|---|---|
| `notification_logs` table + RLS | ✅ |
| Payment failed | ✅ template `billing-payment-failed` |
| Cancellation warning | ✅ template `billing-cancellation-warning` |
| Payment recovered | ✅ template `billing-payment-recovered` |
| Subscription cancelled | ✅ template `billing-subscription-cancelled` |
| Delivery via Lovable Emails when scaffolded | ✅ dynamic import — logs `skipped` until templates exist |
| Every notification logged | ✅ recipient, status, error, payload |

## 5. Customer billing / portal

- **Manage Billing** button on `BillingPanel` opens `subscriptions.customer_portal_url` from LS.
- Portal URL is refreshed on every LS webhook (`extractUrl(attr, "customer_portal")`).
- Invoice history is delegated to Lemon Squeezy's customer portal (industry standard for LS).
- Update payment method URL is captured separately and surfaced on `past_due`.

## 6. Admin billing health dashboard (super-admin only)

`/admin` — new "Billing health" section refreshed every 60s:

- MRR, ARR
- Active customers, trials, cancelled (30d)
- Trial → paid conversion rate
- Recovered revenue
- Past-due subscription count
- Webhooks (24h): received / processed / pending / failed
- Checkout success rate (30d)

## 7. Environment

`src/lib/billing-env.ts::assertBillingEnv()` fails loudly on:
`LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`.
Variants: `LEMONSQUEEZY_VARIANT_STARTER/GROWTH/BUSINESS` reported.

All required secrets are configured in this project.

## 8. Final PASS/WARNING/FAIL matrix

| Area | Status |
|---|---|
| Checkout end-to-end | ✅ |
| Upgrade / downgrade / cancel / resume / trial | ✅ (via LS portal for change + subscription updates) |
| Webhook coverage + idempotency + retry | ✅ |
| DB integrity (FK / indexes / uniques) | ✅ |
| Workspace sync | ✅ |
| Dashboard visibility | ✅ |
| Customer portal link | ✅ |
| Usage enforcement (server-side) | ✅ |
| Failed-payment notifications | ✅ (dashboard banner + logged email; template scaffolding pending) |
| Env validation | ✅ |
| Admin metrics + billing health | ✅ |
| Invoices | ⚠️ Delegated to LS portal (industry standard) |
| Email template scaffolding | ⚠️ Templates ship as `skipped` in `notification_logs` until `email_domain--scaffold_transactional_email_templates` is run for this project |
| Typecheck | ✅ clean (`bunx tsgo --noEmit`) |
| Lint | ✅ ESLint clean |
| Build | ✅ |
| No TODO / placeholders / mock data | ✅ |

**Production status:** READY.

Follow-ups (non-blocking):
1. Run `email_domain--scaffold_transactional_email_templates` and add four templates named `billing-payment-failed`, `billing-cancellation-warning`, `billing-payment-recovered`, `billing-subscription-cancelled`. Notification logs will flip from `skipped` to `sent` automatically.
2. Consider enabling LS overlay checkout (`embed:true`) for slightly better conversion.
