# Enterprise Architecture Consolidation — Phased Plan

This refactor spans ~15 subsystems and thousands of LOC. Shipping it as one commit would break production. Below is the wave breakdown. Each wave is independently deployable, typecheck-clean, and preserves all business logic, RLS, data, webhook URLs, and billing behavior.

I need your approval on the **wave order and scope** before I start Wave 1. If you want a different order (e.g. Integration Framework first because it unblocks more), say so.

---

## Wave 1 — Audit & Dependency Graph (read-only, no code changes)

Deliverable: `.lovable/architecture-audit.md` containing:
- Every duplicate route, component, server fn, table column, and constant
- Domain → owner map (pricing, nav, brand, AI, recovery, integrations, RBAC, flags)
- Dependency graph of what consumes each duplicate (so Wave 2+ can safely delete)
- Concrete removal list per wave

No code touched. This is the safety net for every subsequent wave.

## Wave 2 — Pricing SSOT (`plans` table only)

- Migrate all pricing/limits/trial/success-fee constants out of `src/lib/pricing.ts` into the `plans` table (fields already exist; backfill missing ones via migration).
- Convert `src/lib/pricing.ts` into a thin server-fn wrapper that reads `plans` and caches per request.
- Marketing pricing page, checkout, upgrade, dashboard current-plan card, comparison table, ROI calc, admin billing → all consume the server fn.
- Env vars keep only `LEMONSQUEEZY_VARIANT_*` / store IDs / secrets. No prices, no limits.
- Platform → Billing → Plans becomes the only editor (writes to `plans`, invalidates React Query cache).

## Wave 3 — Platform / Admin Consolidation

- `/admin` legacy tabbed console: keep panels as internal components, remove top-level route, redirect `/admin` and every `/admin/<tab>` to the equivalent `/platform/*` route.
- Delete every `admin.v2.*` file (already partially done last turn — finish).
- One super-admin console at `/platform`. Customer sidebar loses every `adminOnly` leak.

## Wave 4 — Unified Navigation Registry

- Single `src/lib/nav/registry.ts` typed as `{ id, label, path, icon, audience: 'customer' | 'platform', permission?, badgeKey?, keywords, group }`.
- Sidebar, top nav, command palette, quick actions, breadcrumbs, and global search all derive from it.
- Delete `src/lib/app-nav.ts` and `src/lib/platform/nav.ts` after migration.

## Wave 5 — Integration Framework (biggest wave)

Split into 5 sub-steps, each shippable:

1. **Provider Registry** — one `provider_catalog` row per provider with JSON `credential_schema`, `capabilities`, `verification`, `webhook_config`. Migrate current hardcoded provider metadata.
2. **Dynamic Form Engine** — one `<ProviderCredentialForm schema={…} />` component; delete every per-provider form.
3. **Unified Connection Card** — one `<ConnectionCard integration={…} />`; delete per-provider cards. Realtime status via existing `supabase.channel`.
4. **Verification Engine** — one server fn `verifyIntegration(integrationId)` dispatches to per-provider verifiers behind a common interface returning the standardized status enum.
5. **Webhook Engine** — one `/api/public/webhooks/$provider/$integrationId` handler (already exists) becomes the single entry; per-provider signature verifiers behind a common interface. DLQ + replay reuse existing `webhook_logs` + `job_queue`.

Webhook URLs already have this shape, so no customer needs to re-paste anything. Existing signing secrets are preserved.

## Wave 6 — Realtime & Health Dashboard

- One `/platform/integrations` dashboard subscribing to `integrations` + `webhook_logs` via `postgres_changes`. Delete duplicate health widgets.
- Customer `/integrations` page uses the same `<ConnectionCard>` but scoped to their workspace.

## Wave 7 — Dead Code Sweep & Final Validation

- Delete unused routes, files, imports, enums, helpers, commented code found in Wave 1.
- `tsgo` clean, `bun run build` clean, `run_rls_test_suite` green.
- Produce final Architecture Audit Report with the ✔ checklist from your brief.

---

## What I need from you

1. **Approve the wave order** (or reorder — e.g. Integration Framework before Pricing if that's higher business priority).
2. **Confirm no customer-facing URL changes** beyond `/admin/*` → `/platform/*` redirects. In particular, `/pricing`, `/integrations`, `/dashboard`, `/app`, and every webhook URL stay identical.
3. **Confirm I can drop `src/lib/pricing.ts` as a hardcoded module** and replace it with a server-fn-backed loader. This is a breaking change for any component that imports `PLANS` synchronously at module scope — I'll convert those call sites in the same wave.

Once you approve, I'll start with Wave 1 (audit only, zero code changes) and post the audit doc for you to review before Wave 2 touches any code.
