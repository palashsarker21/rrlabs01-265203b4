# Enterprise Consolidation Plan

Frontend-only refactor. No schema, RLS, server function logic, recovery, billing, AI, or webhook changes. Business logic in `src/lib/**/*.functions.ts`, `*.server.ts`, `src/routes/api/**` stays untouched.

## 1. Customer Navigation (SSOT: `src/lib/app-nav.ts`)

Reduce `APP_NAV` to exactly 5 groups, each a single leaf:

- Overview → `/app`
- Analytics → `/analytics`
- Integrations → `/integrations`
- Team → `/team`
- Billing → `/billing/statements`

Move everything else off the sidebar:

- Settings (AI, Notifications, Email Prefs, Security, Change Password), Support, Recovery Engine/Strategy, RLS Verification, Recovery Events → still reachable via top-bar user menu + in-page links, but removed from sidebar and command palette groups.
- WhatsApp deep page (`/integrations/whatsapp`) folded into the unified Integration Center; route file kept as redirect to `/integrations?provider=meta_wa` to preserve any external links.

## 2. Overview Page (`src/routes/_authenticated/app.tsx`)

Restructure existing widgets (no new data sources) into 7 named sections in this order:
Workspace Summary, Recovery Summary, Revenue Summary, Recent Activity, Integration Status, Billing Status, Quick Actions. Remove any duplicated cards/links that also live on Analytics or Integrations.

## 3. Analytics Page (`src/routes/_authenticated/analytics.tsx`)

Single tabbed page consolidating: Revenue, Recovery, Funnels, Reports, Performance, Exports, Customers, Recovery Results. Reuses existing analytics queries — no new endpoints. Drops the separate `/events` from the sidebar (page remains, linked from Analytics → Recovery Results drill-down).

## 4. Integration Center (`src/routes/_authenticated/integrations.tsx`)

Rebuilt around one reusable component set (new files under `src/components/integrations/`):

- `ProviderCard.tsx` — logo, status chip (Connected/Disconnected), Last Verified, Webhook status, Credential status, Realtime health; actions: Connect, Disconnect, Verify, Rotate Secret, Logs.
- `ProviderConnectDialog.tsx` — dynamic form driven by `provider_catalog.setup_fields` (no per-provider layouts).
- `ProviderLogsDrawer.tsx` — thin wrapper over existing `listWebhookLogs`.
- `WebhookPanel.tsx` — one component for URL/secret/verify token reveal + rotate.

Page structure: 4 sections (Stores, Payment Gateways, Email, Messaging) each rendering `ProviderCard` from filtered `provider_catalog`. All existing per-provider ad-hoc UI in `integrations.tsx` (1550 → target ~400 lines) collapses into these components. Save/Test/Disconnect/Rotate all go through existing server functions unchanged.

## 5. Store Provider Cleanup

Filter Stores to `shopify`, `woocommerce`, `custom` only. Removals are UI-only:

- `provider_catalog` DB rows for `edd`, `memberpress`, `surecart` are **not** deleted (schema untouched). Frontend simply hides any provider whose code isn't in the allow-list. Server adapters (`eddAdapter`, `memberpressAdapter`, `surecartAdapter`) stay — orphaned but harmless.
- If a `custom` provider row doesn't exist in catalog, add it via a new migration? **No — schema untouched per instructions.** Instead, "Custom Store API" is rendered from a small client-side constant that reuses the same `ProviderCard` + dynamic form; save flow reuses existing `saveIntegration` with a generic provider code already supported, OR is shown as "Contact support to enable" if not in catalog. Will confirm during implementation which path the catalog already supports and pick the non-schema-changing one.

Payments, Email, Messaging: kept as-is, only UI de-duplicated.

## 6. Route Deletions / Redirects

Delete duplicate/legacy customer routes not in the 5-module set from the sidebar, but preserve URL access with redirects where reasonable:

- `getting-started.tsx`, `getting-started.complete.tsx`, `recovery-strategy.tsx`, `rls-verification.tsx`, `notifications.tsx`, `settings.*`, `events.tsx`, `integrations.whatsapp.tsx`, `onboarding.tsx`, `upgrade.tsx`, `checkout*.tsx`, `billing.statements.tsx`, `invite.$token.tsx`, `admin.tsx`, `admin.email.*`, `admin.v2.$.tsx` — **kept as files** (still linked from top-bar menu, billing flow, admin, onboarding redirect). Only removed from `APP_NAV`.

No route file deletions in this pass (removing them risks breaking billing/admin/onboarding flows that are out of scope). The consolidation is enforced via navigation + Overview + Integration Center being the only entry points a customer sees.

## 7. Validation

- `bunx tsgo --noEmit` clean
- Manual smoke via Playwright: `/app`, `/analytics`, `/integrations`, `/team`, `/billing/statements` all render; sidebar shows exactly 5 items; Integration Center renders Stores (3), Payments, Email, Messaging with unified cards.
- Grep confirms no duplicate provider card components remain.

## Out of Scope (explicit)

- No changes to: `src/lib/**/*.functions.ts` handlers, `src/lib/**/*.server.ts`, `src/routes/api/**`, `supabase/migrations/**`, RLS, auth, `/platform/**`.
- No new features, no schema edits, no removed server adapters.

## Deliverable

Audit report at end of implementation confirming each checkbox from the request.
