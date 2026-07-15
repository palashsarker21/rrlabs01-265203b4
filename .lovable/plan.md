
# Integration Center — Phased Completion

Foundation already in place from the previous pass and NOT to be redone:
`provider_catalog`, `provider_limits`, `feature_flags`,
`workspace_feature_overrides`, `webhook_logs`, `provider_status`,
`workspace_provider_limit()` RPC, `/api/public/webhooks/$provider.$integrationId`,
`plan-limits.server.ts`, `providers.functions.ts`, `admin-features.functions.ts`,
`/integrations` route with stepper + provider cards, admin "Features & Providers"
tab, `/setup → /integrations` redirect.

I will proceed one phase at a time and wait for your explicit approval
before starting the next. No UI redesign; existing shadcn tokens only.

## Phase 1 — Per-card webhook & lifecycle actions (client + server)

Every store / gateway / messaging / email card gains the full contract:

- Connection status pill (disconnected / pending / connected / error)
- Webhook URL row with Copy button (built from `webhook-url.ts`)
- Webhook secret: reveal-once, Rotate button (returns new value, writes to
  `integrations.webhook_secret`, records audit event)
- Verify Token row for Meta WhatsApp / custom providers (from
  `provider_catalog.webhook_events` + setup_fields)
- Last delivery / last success / retry count / verification status — read
  from `webhook_logs` + `provider_status`
- "View logs" drawer showing last 20 `webhook_logs` rows (event, status,
  latency, error)
- Test Connection button → server fn `testIntegration(id)`; result written
  to `provider_status.last_test_ok` and surfaced inline
- Disconnect / Reconnect buttons routed through existing `providers.functions.ts`
- Setup instructions + required scopes rendered from
  `provider_catalog.setup_instructions` / `required_scopes`

Server work: extend `providers.functions.ts` with `rotateWebhookSecret`,
`getWebhookLogs`, `testIntegration`, `reconnectIntegration`; all guarded by
`requireSupabaseAuth` + workspace-role check. No provider-specific branches
in components — everything reads `provider_catalog`.

## Phase 2 — Provider-specific setup fields & tests

For each kind, the connect form renders inputs from
`provider_catalog.setup_fields` (already JSON-driven). Real `test()`
implementations wired for the providers we already ship credentials for:

- Store: Shopify (existing), WooCommerce (REST /wp-json/wc/v3/system_status),
  EDD, MemberPress, SureCart, custom → HEAD ping
- Gateway: Stripe (accounts/retrieve), Lemon Squeezy (existing), Paddle
  (auth ping), PayPal (OAuth token), Adyen (accountHolder ping), custom → HEAD
- Email: Resend (existing), SendGrid (v3/scopes), SMTP (nodemailer verify),
  Mailgun (domains list), Postmark (server info)
- Messaging: Twilio SMS / WA (Accounts.json), Meta WA Cloud (phone_numbers)

All calls happen in `providers/<code>/adapter.server.ts`; the generic
`testIntegration` server fn dispatches by `provider_catalog.code`. Keys
encrypted at rest with `RRLABS_ENCRYPTION_KEY` (reusing existing helper).
Any provider without credentials remains a working shell with a "coming
soon" test result — never hidden.

## Phase 3 — Activation Review & Recovery Engine gate

New "Activation Review" step in the stepper reads:

- ≥1 connected store, ≥1 connected gateway, ≥1 connected email OR
  messaging provider (from `integrations`)
- All those integrations have `verification_status = 'verified'` and
  `provider_status.last_test_ok = true`
- No `webhook_logs` failures in the last 24h for those integrations

Only when every check passes does the "Activate Recovery Engine" button
enable and call an existing `setWorkspaceEngine(true)` server fn. Otherwise
the row shows what's missing with a link to the failing card.

## Phase 4 — Plan limits UX + super-admin overrides

- Locked provider cards render an "Upgrade Required" badge with current
  plan, required plan, and CTA to `/upgrade` (feature never hidden).
  `getEffectiveLimits(workspaceId)` already exists — wire it into the
  integrations page for count-based limits per `provider_kind`.
- Admin "Features & Providers" tab gains:
  - Per-workspace limit override editor (writes
    `workspace_feature_overrides.limit_override` keyed
    `limit:<kind>`)
  - Global maintenance-mode toggle (feature_flag `maintenance_mode`)
  - Beta-features toggle per provider (`provider_catalog.beta`)
- Frontend never trusts limits; every mutating server fn re-checks via
  `assertCanConnect()`.

## Phase 5 — Verification & report

Run typecheck, ESLint, build. Produce a final report listing:

1. New providers registered (from `provider_catalog` seed)
2. Webhook manager surface (per-card actions + logs drawer)
3. Feature-lock surfaces (which cards, which limits)
4. Plan-restriction call sites (`assertCanConnect` usage)
5. Admin feature manager additions
6. DB changes recap (already-migrated tables + any Phase-4 addendum)
7. `rg` output confirming zero hardcoded provider codes in components
   under `src/routes/_authenticated/integrations.tsx` and children

## Out of scope

- Any visual redesign of existing components
- Pricing/landing copy (already synchronized)
- Rewriting the managed `_authenticated/route.tsx` gate
- Full SMTP relay infrastructure — we only verify creds, not host our own

## Approval gate

Reply "approve phase 1" (or with edits) and I'll start. After each phase I
will stop and wait for the next approval before continuing.
