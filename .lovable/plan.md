
# Recovery Engine v2 — Audit & Wave Plan

## 1. Audit findings (what already works)

Reused as-is (do NOT rebuild):

- **Schema**: `recovery_events` (24 cols, cadence_step + next_run_at scheduler already in place), `recovery_attempts` (21 cols incl. ai_model, prompt tokens, delivery timestamps), `recovery_templates` (per workspace/step/channel), `customers`, `integrations`, `job_queue`, `webhook_logs`, `email_logs`, `email_webhook_logs`, `notification_logs`, `notification_preferences`, `alerts` with dedupe + severity, `audit_logs`, `analytics_events`, `success_fee_*`. RLS + workspace isolation is complete via `is_workspace_member` / `can_manage_workspace` / `is_super_admin`.
- **Engine**: `src/lib/recovery/engine.server.ts` (502 LOC) — analyze → schedule → dispatch loop with cadence steps and status transitions.
- **Dispatch**: `src/lib/recovery/dispatch.server.ts` — channel routing (Email/WhatsApp) via existing integrations.
- **Webhooks**: `api/public/webhooks/stripe.ts`, `lemonsqueezy.ts`, generic `$provider.$integrationId.ts` — signature verification + logging already in `webhook_logs`.
- **AI gateway**: `src/lib/ai-gateway.server.ts` — thin wrapper on Lovable AI (`google/gemini-3-flash-preview` default).
- **Cron**: `api/public/hooks/recovery-cadence.ts` + `success-fee-monthly.ts` via `pg_net` + apikey pattern.
- **Notifications/alerts**: triggers for integration_error, webhook_issue, recovery_attempt_failed, activation_status.
- **Analytics**: `recovery-analytics.functions.ts` (KPIs), `recovery-events-search.functions.ts` (drill-down + CSV/PDF), analytics dashboard wired.
- **Email**: Resend infra with 15 templates, unsubscribe center, sandbox, deliveries, webhooks.
- **WhatsApp**: multi-tenant Cloud API adapter + webhook.
- **Security**: RLS suite (`run_rls_test_suite`), password policy, HMAC webhook verify, rotation, audit triggers.

### Gaps vs the target architecture

| Area | Gap |
|---|---|
| Failure classification | `failure_category` exists but no canonical enum/rules (soft/hard/expired/insufficient/auth-required/CVC/fraud/temp/timeout/network/unknown). |
| Customer intelligence | No `recovery_score` / `risk_score` / `clv` / `churn_score` / `customer_segment` / `preferred_language` / `preferred_timezone` columns. |
| Template reuse | `recovery_templates` unique on `(workspace, step, channel)` — no matching on failure/language/country/segment. No confidence scoring, no AI-generated template caching. |
| AI decision engine | Engine generates copy but does not persist decision (channel, tone, send-time, retry schedule, template match confidence, `ai_cost`, `prompt_version`, `last_ai_version`). |
| Multilingual | No language detect/select at event/customer level. |
| Learning loop | Attempts capture delivered/opened via `email_webhook_logs` but no aggregated template/country/language/gateway performance materialized view. |
| Queue reliability | `job_queue` exists but no explicit DLQ status, retry-limit + exponential-backoff policy for AI + dispatch. |
| Automation settings | No per-workspace quiet hours / business hours / holiday calendar / max retries / preferred channels row. |
| Customer portal | Only checkout status + upgrade — no self-serve retry / update payment method / invoice download. |
| Observability | Structured logs partial; no AI usage/queue metrics endpoint. |

## 2. Non-negotiable guardrails

- Only additive migrations (new columns/tables/enums/indexes). No drops, no renames, no policy loosening.
- Every new `public` table: GRANTs + RLS + policies + updated_at trigger in the same migration.
- Reuse existing tables — extend, don't shadow. Templates get new columns + a second matching index; do not create `recovery_templates_v2`.
- All new server logic in `createServerFn` or `src/routes/api/public/*` (TanStack) — no new Supabase Edge Functions.
- AI-only when template match confidence < threshold; cache generated copy back into `recovery_templates` with match keys.
- Gemini via existing `ai-gateway.server.ts`; provider abstraction accepts OpenAI/Claude later without touching call sites.
- Strict TS, mobile-first, WCAG 2.2 AA, workspace isolation preserved.

## 3. Waves (each independently shippable + reversible)

### Wave A — Schema & classification (foundation)
Additive migration:
- Enum `failure_classification` (soft_decline, hard_decline, expired_card, insufficient_funds, auth_required, incorrect_cvc, fraud_suspected, temporary_bank, gateway_timeout, network_error, unknown).
- `recovery_events`: add `failure_classification`, `recovery_score`, `risk_score`, `preferred_language`, `preferred_timezone`, `notification_channel`, `template_id`, `template_confidence`, `last_ai_version`, `prompt_version`, `ai_processing_ms`, `ai_cost_micros`.
- `recovery_attempts`: add `delivery_status`, `read_status`, `click_status`, `opened_at`, `clicked_at`, `read_at`, `provider_error_code`, `template_id`.
- `recovery_templates`: add `failure_classification`, `country`, `language`, `gateway`, `product_kind`, `customer_segment`, `source` (curated|ai_generated), `usage_count`, `success_count`, `last_used_at`, `confidence`.
- `customers`: add `preferred_language`, `preferred_timezone`, `country`, `clv_cents`, `churn_score`, `segment`.
- New table `workspace_automation_settings` (business_hours jsonb, quiet_hours jsonb, timezone, holiday_calendar jsonb, max_retries int, preferred_channels text[], ai_enabled bool, retry_schedule_minutes int[]).
- New table `recovery_template_matches` (audit which template matched which event — for the learning loop) or persist inline on event.

### Wave B — Failure classifier + AI decision engine
`src/lib/recovery/classify.server.ts`: pure function mapping Stripe/LS decline codes → `failure_classification`.
`src/lib/recovery/decide.server.ts`: given event + customer intelligence, returns `{channel, language, tone, send_at, retry_schedule, template_match, need_generation}`.
Wire into engine BEFORE dispatch; persist decision on event. Zero behavior change when AI disabled.

### Wave C — Template matcher + AI generation cache
`matchTemplate(workspaceId, {classification, language, country, gateway, product_kind, segment, step, channel})` → returns best row + confidence. If ≥ threshold reuse, else generate via Gemini and INSERT new template with match keys + `source=ai_generated`. Increment `usage_count` on use, `success_count` when the event recovers.

### Wave D — Queue reliability + retry policy
Extend `job_queue` with `dlq` status, `attempt_count`, `next_attempt_at`, `last_error`. Exponential backoff helper. Idempotency on `(workspace, external_event_id, step, channel)` — already partially covered by `recovery_events` unique constraint; add for attempts.

### Wave E — Automation settings UI + engine honors them
Settings page under `_authenticated/settings.automation.tsx`. Engine reads quiet hours + retry schedule + max_retries before scheduling `next_run_at`.

### Wave F — Learning loop + expanded analytics
Materialized view / server fn aggregating template/country/language/gateway performance. Dashboard adds MRR/ARR saved, recovery time, WhatsApp read rate, per-country/language/gateway breakdowns. AI success rate + template success rate cards.

### Wave G — Customer portal (public, tokenized)
`/portal/$token` public route with signed HMAC token (14-day expiry). Actions: view invoice, retry payment (creates Stripe/LS checkout), update payment method (portal link), contact support. Zero auth, but every action re-verifies token + event ownership.

### Wave H — Observability + tests
Structured log helper `logRecoveryEvent(stage, event_id, meta)`; admin metrics page for AI usage (tokens, cost, cache hit rate), queue depth, DLQ count. Vitest coverage: classifier map, template matcher, decision engine, quiet-hours scheduler, DLQ handoff, token verification.

## 4. Deliverables per wave

Files touched + migration diff + type-check clean + at least one screenshot for UI waves.

## 5. Suggested execution order

A → B → C → D → E → F → G → H. Each wave = one commit-sized change.

**Approve to start with Wave A (Schema & classification)**, or say which wave to jump to (e.g. straight to C if you want AI template reuse first).
