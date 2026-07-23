# RRLabs Architecture Audit — Wave 1

Read-only audit. No code changed. Waves 2–7 remove/refactor items listed here.

## 1. Domain → Owner Map (target SSOT)

| Domain | Canonical owner (target) | Duplicates found today |
|---|---|---|
| Pricing / plans / limits / trial / success-fee | `public.plans` table | `src/lib/pricing.ts` (218 LOC hardcoded); `LEMONSQUEEZY_VARIANT_*` env vars OK (variant IDs only) |
| Navigation (customer) | Unified `src/lib/nav/registry.ts` | `src/lib/app-nav.ts` (124 LOC) |
| Navigation (platform) | Same unified registry, `audience: 'platform'` | `src/lib/platform/nav.ts` (311 LOC) |
| Brand | `src/lib/brand.ts` | ✔ already single |
| AI settings | `public.organization_ai_settings` + `public.ai_routes` | ✔ single |
| Recovery policies / retry schedule | `public.workspace_automation_settings` | ✔ single |
| Feature flags | `public.feature_flags` | ✔ single |
| Roles / permissions | `public.user_roles` + `public.role_permissions` + `has_permission()` | ✔ single |
| Provider metadata | `public.provider_catalog` | `src/lib/integrations/catalog.ts` (382 LOC hardcoded) + `src/lib/integrations/registry.server.ts` (542 LOC) — partial overlap |
| Integration credentials | `public.integrations` | ✔ single storage; UI/verification fragmented (see §4) |
| Webhook endpoints | `/api/public/webhooks/$provider/$integrationId` | ✔ unified URL; per-provider handlers scattered |
| Workspace / org | `public.workspaces` + `public.organizations` | ✔ single |

## 2. Duplicate Routes / Pages

| Duplicate | Canonical | Action |
|---|---|---|
| `/admin/v2/*` (splat redirector — already stubbed) | `/platform/*` | Keep redirect stub — done in prior turn |
| `/admin` (legacy tabbed console at `admin.tsx`) + all `admin.email.*` | Move under `/platform/*` taxonomy; keep `admin.email.*` as `/platform/communications/email*` OR alias | Wave 3 |
| `/setup` → already redirects to `/integrations` | — | ✔ |
| `/app` vs `/dashboard` (both exist for signed-in home?) | Verify one canonical | Wave 3 |

## 3. Duplicate Nav / Sidebars / Palettes

- `src/lib/app-nav.ts` (customer) + `src/lib/platform/nav.ts` (platform) → **merge into `src/lib/nav/registry.ts`** with `audience` discriminator (Wave 4).
- `app-sidebar.tsx` + `platform-sidebar.tsx` → shared `<NavSidebar audience={…}/>` reading registry.
- `app-command-palette.tsx` + `platform/command-palette.tsx` → shared `<CommandPalette audience={…}/>`.

## 4. Integration Layer Fragmentation

Currently three overlapping sources of provider truth:
1. `public.provider_catalog` table
2. `src/lib/integrations/catalog.ts` — hardcoded provider list, credential fields, setup copy
3. `src/lib/integrations/registry.server.ts` — 542 LOC of per-provider verification + webhook logic (branching switch statements)

Consumers: `providers.functions.ts`, `integrations.functions.ts`, `integrations.tsx`, `integrations.whatsapp.tsx`, `plan-limits.server.ts`, `admin-features.functions.ts`.

**Target framework (Wave 5):**
```
Provider Registry (DB)
  └─ credential_schema JSON  → <ProviderCredentialForm/>   (delete per-provider forms)
  └─ capabilities JSON       → <ConnectionCard/>           (delete per-provider cards)
  └─ verification config     → verifyIntegration()         (single dispatcher, per-provider verifiers plug in)
  └─ webhook config          → /api/public/webhooks/$p/$id (single handler, per-provider signature verifier plugs in)
```

## 5. Duplicate Helpers / Constants

| Duplicate | Canonical | Notes |
|---|---|---|
| `src/lib/providers.functions.ts` + `src/lib/integrations.functions.ts` + `src/lib/integrations/registry.server.ts` | Merge behind Provider Framework | Wave 5 |
| `src/lib/pricing.ts` constants | `plans` table via `getPricing()` server fn | Wave 2 |
| `src/lib/billing.ts` + `src/lib/billing-env.ts` + `src/lib/billing.functions.ts` + `src/lib/billing-summary.functions.ts` + `src/lib/billing-notifications.server.ts` | Namespace under `src/lib/billing/*` | Wave 7 (cosmetic) |

## 6. Dead Code Candidates (verify before delete in Wave 7)

- `src/lib/admin-features.functions.ts` — check if still called
- `src/routes/_authenticated/admin.v2.$.tsx` — keep redirect stub
- `src/lib/onboarding-report.functions.ts` — verify UI still exposes report
- Legacy `admin.email.*` routes if migrated to `/platform/communications/*`

## 7. Wave-by-Wave Removal List

### Wave 2 (Pricing SSOT)
DELETE hardcoded exports from `src/lib/pricing.ts`; replace with `getPricing()` server fn reading `plans`. Migration adds any missing columns (`features jsonb`, `tagline`, `success_fee_bps`, `monthly_base_cents`, `highlight`, `enterprise`).
Update: `pricing.tsx`, `index.tsx`, `upgrade.tsx`, `checkout.tsx`, `admin.tsx` (billing tab), `admin-pricing.functions.ts`.

### Wave 3 (Admin/Platform Consolidation)
Move panels from `admin.tsx` under `/platform/*` routes. Redirect `/admin` → `/platform`. Redirect `/admin/email*` → `/platform/communications/email*`. Delete `adminOnly` filtering from customer sidebar (already partially done — verify).

### Wave 4 (Unified Nav Registry)
New `src/lib/nav/registry.ts`. Refactor sidebars + palettes to consume it. Delete `app-nav.ts` and `platform/nav.ts`.

### Wave 5 (Integration Framework)
5a. Migration: add `credential_schema jsonb`, `verification jsonb`, `webhook_config jsonb`, `capabilities jsonb` columns to `provider_catalog`. Backfill from `catalog.ts`.
5b. New `<ProviderCredentialForm schema/>` component. Delete `catalog.ts`.
5c. New `<ConnectionCard/>`. Delete per-provider cards in `integrations.tsx`.
5d. New `verifyIntegration(id)` server fn with per-provider verifier interface. Refactor `registry.server.ts` into small pluggable modules under `src/lib/integrations/providers/*`.
5e. Confirm single `/api/public/webhooks/$provider/$integrationId` handler dispatches through a shared signature-verifier interface.

### Wave 6 (Realtime & Health)
Replace polling in `platform.system-health.tsx` and `integrations.tsx` with `supabase.channel('integrations').on('postgres_changes', …)`.

### Wave 7 (Sweep + Validation)
Delete confirmed-dead files. Run `tsgo`, `bun run build`, `run_rls_test_suite`. Produce final report against your ✔ checklist.

## 8. Preserved (do not touch)

- `public.recovery_events`, `public.recovery_attempts`, `public.recovery_templates` — recovery logic
- `public.ai_*` tables — AI decision logic
- `public.subscriptions`, `public.billing_events`, `public.success_fee_*` — billing behavior
- Every webhook endpoint URL (customers already configured them)
- Every RLS policy (must remain green after each wave)
- Integration signing secrets in `integrations.credentials`

## 9. Risk Register

| Risk | Wave | Mitigation |
|---|---|---|
| `PLANS` used at module scope by SSR marketing pages | 2 | Convert to loader + `useSuspenseQuery`; SSR renders from `plans` table |
| Bearer middleware regression when adding server fns | 2, 5 | Keep existing `attachSupabaseAuth` in `src/start.ts`; new fns use `requireSupabaseAuth` where needed |
| Removing hardcoded provider list breaks in-flight integrations | 5 | Backfill migration seeds `provider_catalog` from `catalog.ts` before deleting file |
| Realtime subscription leaks | 6 | Use `useEffect` + `removeChannel` cleanup per docs |

---

**Status:** Wave 1 complete. Awaiting your GO to start Wave 2 (Pricing SSOT). Each subsequent wave will ship as its own commit with typecheck + build clean before I move on.
