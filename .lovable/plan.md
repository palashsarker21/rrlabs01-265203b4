# Integration Center — Production Rebuild

Replace the single-page Stripe onboarding wizard with a config-driven Integration Center. All providers, limits, and feature toggles come from the database — no hardcoded provider logic in components.

## 1. Database (new tables + migrations)

All in `public`, with GRANTs, RLS, and `service_role` write access.

- `provider_catalog` — canonical registry of every provider we support.
  Columns: `id`, `code` (unique, e.g. `shopify`, `stripe`, `resend`), `kind` (`store`|`gateway`|`email`|`messaging`), `name`, `description`, `logo_url`, `setup_instructions` (md), `required_scopes` (jsonb), `setup_fields` (jsonb — declares api_key/domain/phone_id/etc), `webhook_events` (jsonb), `docs_url`, `enabled` (bool, admin-toggleable), `beta` (bool), `sort_order`, timestamps.
- `provider_limits` — plan → provider kind → max count.
  Columns: `plan_code` (fk to `plans.code`), `provider_kind`, `max_count` (null = unlimited). Seeded from Starter=1/1/1/1, Growth=3/3/∞/∞, Business/Enterprise=∞.
- `feature_flags` — global toggles.
  Columns: `key` (unique), `label`, `description`, `enabled`, `beta`, `maintenance_mode` (bool). Read-only for authenticated; write via super_admin RPC.
- `workspace_feature_overrides` — per-workspace overrides.
  Columns: `workspace_id`, `feature_key`, `enabled`, `limit_override` (int, nullable), `notes`, super-admin managed.
- `webhook_logs` — every inbound webhook.
  Columns: `id`, `workspace_id`, `integration_id`, `provider_code`, `event_type`, `signature_valid` (bool), `status_code`, `payload_hash`, `error`, `received_at`, `processed_at`, `attempt_count`. Indexed on `(integration_id, received_at desc)`.
- `provider_status` — cached last-known health per integration.
  Columns: `integration_id` (pk), `last_delivery_at`, `last_success_at`, `last_error`, `retry_count`, `verification_status` (`pending`|`verified`|`failed`), `updated_at`.

Extend existing `integrations` table with: `webhook_secret` (text, encrypted), `webhook_verify_token` (text), `provider_account_id` (text), `verification_status` (text), `last_test_at`, `last_test_ok` (bool). Keep credentials encrypted via existing `RRLABS_ENCRYPTION_KEY`.

Seed `provider_catalog` in-migration with all 20 providers listed in the request. Seed `provider_limits` from PLANS.

## 2. Provider abstraction

`src/lib/providers/registry.server.ts` — reads `provider_catalog` and returns typed provider descriptors. No provider name is ever hardcoded in components.

Per-provider handler modules under `src/lib/providers/<code>/` implementing a common interface:
```
connect(fields) → { account_id, webhook_secret }
test(integration) → { ok, message }
webhook(payload, signature) → { event, valid }
disconnect(integration) → void
```
Providers stubbed for now: `paddle`, `paypal`, `adyen`, `sendgrid`, `mailgun`, `postmark`, `smtp`, `twilio_sms`, `twilio_wa`, `meta_wa`, `woocommerce`, `edd`, `memberpress`, `surecart`, `custom_store`, `custom_gateway`. Existing `stripe`, `lemonsqueezy`, `shopify`, `resend` wired to real logic where already implemented; the rest expose a working connect form + webhook URL + verification flow, with provider API calls returning a typed "coming soon" from `test()` so the UI is honest rather than fake.

## 3. Webhook infrastructure

- Generic public route: `src/routes/api/public/webhooks/$provider.$integrationId.ts` — resolves the integration, verifies signature via the provider handler, writes to `webhook_logs`, updates `provider_status`, dispatches to the recovery engine. Existing `/webhooks/stripe` and `/webhooks/lemonsqueezy` remain as compat shims that redirect.
- `getWebhookUrl(integration)` helper returns `https://<published-host>/api/public/webhooks/<code>/<id>`.
- Server fns: `rotateWebhookSecret`, `testIntegration`, `getWebhookLogs(integrationId)`.

## 4. Integration Center UI

Replace `src/routes/_authenticated/onboarding.tsx` and `src/routes/_authenticated/setup.tsx` (or add `/integrations`) with a stepper:

Step 1 Store → Step 2 Gateway → Step 3 Email → Step 4 Messaging → Step 5 Activation Review.

One component `<ProviderCard provider={...} integration={...} />` renders every card, driven entirely by `provider_catalog`. Fields shown per spec: logo, description, status, connect/disconnect/reconnect, webhook URL + copy, webhook secret + rotate, last delivery, verification, test, setup instructions, account ID, timestamps. Locked cards (over plan limit or `enabled=false`) show an "Upgrade Required" badge with reason + current plan + required plan + upgrade CTA — never hidden.

Activation Review reads live from `provider_status` + `integrations` and only enables "Activate Recovery Engine" when all required checks pass.

Keep the existing visual design tokens — no restyling.

## 5. Plan enforcement (server-side)

`src/lib/plan-limits.server.ts`:
- `getEffectiveLimits(workspaceId)` — joins current plan → `provider_limits` → `workspace_feature_overrides`.
- `assertCanConnect(workspaceId, kind)` — throws 402 when at limit. Super admin bypass.
Called inside every provider `connect` server fn. Frontend also reads the same limits to render locked states — but never trusts them.

## 6. Super Admin Feature Manager

New tab under `/admin` → "Features & Providers":
- Toggle feature flags, maintenance mode, beta features.
- Enable/disable providers in `provider_catalog`.
- Per-workspace overrides (grant extra stores/gateways, unlock features).
All via super-admin-only server fns (`has_role(_, 'super_admin')`).

## 7. Verification

Typecheck (`bunx tsgo --noEmit`), ESLint, and build must pass. Final report lists new providers, webhook route, feature-lock surfaces, plan-limit call sites, admin tab, and DB tables — with a grep confirmation that no provider `code` string appears in a component conditional.

## Out of scope (explicit)

- Not implementing real API integrations for the 16 stub providers this pass — they get working shells + webhook URLs + admin toggles, so adding a real implementation later is a per-file drop-in. Confirm if you want any specific one fully wired now (e.g. WooCommerce, Meta WhatsApp Cloud, Twilio).
- Not touching pricing/landing copy — already synchronized in the previous pass.

## Files (new / changed)

New: 1 migration, ~18 provider modules, `providers/registry.server.ts`, generic webhook route, `plan-limits.server.ts`, `integration-center/*` components, admin `features-tab.tsx`, `webhook-logs.tsx`.
Changed: `onboarding.tsx`, `setup.tsx`, `admin.tsx`, `types.ts` (auto), route tree (auto).

## Confirm before I start

1. **Stub scope** — OK to ship 16 providers as working shells (real UI + webhook URL + connect form + admin toggle, but their `test()` returns "coming soon" until API code is added), or do you want a subset fully wired now?
2. **Route** — replace `onboarding.tsx` in place, or add `/integrations` and keep onboarding as a redirect?
3. **Encryption** — reuse `RRLABS_ENCRYPTION_KEY` for provider credentials at rest (already used elsewhere)?
