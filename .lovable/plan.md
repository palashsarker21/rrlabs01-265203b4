# Wave 2 — Enterprise Public-Site Upgrade (extend-only)

Wave 1 already shipped: central registries (`SOCIAL_PROFILES`, `CONTACT_PHONES`, `COMPANY_METADATA` in `src/lib/brand.ts`), Organization + WebSite JSON-LD with SearchAction, breadcrumb helper (`src/lib/seo/breadcrumbs.ts`), Trust Center (`src/routes/security.tsx`), Contact copy-actions, analytics registry + `analytics_events` table + server fn, ShareButtons component, social/phone click tracking, sitemap.xml (registry-driven), robots.txt with AI-bot rules. 51 tests pass.

Wave 2 extends that surface. Nothing existing is removed or reshaped; new code plugs into existing modules.

## Scope by section

### SEO / Structured Data (items 1–8)
- Extend Organization JSON-LD in `src/routes/__root.tsx`: add `email`, `telephone`, `address` (from `COMPANY_METADATA`), `foundingDate`, `founder`, expand `contactPoint` to include both `CONTACT_PHONES` entries with `contactType` + `availableLanguage`. Keep existing `@graph` shape.
- Wire `buildBreadcrumbScript` (already exists) into every top-level public route's `head().scripts`: `/features`, `/pricing`, `/blog`, `/docs`, `/faq`, `/about`, `/contact`, `/security`, `/status`, `/integrations`, plus `blog.$slug` and `docs.$slug` (dynamic label from loader).
- Audit + fill OG/Twitter parity per route via a new helper `src/lib/seo/meta.ts` (`buildPageMeta({title, description, path, image?})` → returns the full `meta[]` array). Refactor each public route's `head()` to call it — same output, one source of truth.
- Canonical: helper already emits absolute URLs; ensure every public leaf uses `canonicalFor(path)` in `head().links`.
- Sitemap: audit `src/routes/sitemap[.]xml.ts` `ROUTE_REGISTRY` — add any missing legal/integrations paths; keep dynamic blog fetch.
- robots.txt: verified in Wave 1; re-audit against new routes.

### Trust Center (item 9)
Already shipped in Wave 1. Verify all 10 sections render, add missing "Data Protection" callout (retention, deletion rights, DPA link) if not already present.

### Status Page — live probes (item 10)
New infrastructure, opt-in and cache-guarded:
- Migration: `system_health_probes` table (component, status enum healthy|degraded|outage, latency_ms, checked_at, detail) + `system_health_history` (daily rollup). RLS: public SELECT of latest snapshot only; service_role writes.
- Server route `src/routes/api/public/health/probe.ts`: cron-callable POST that runs probes for Website, Dashboard, API, Auth, Email (Resend), Webhooks (last 5min error rate from `webhook_logs`), Recovery Engine (job_queue backlog), Database (`select 1`), AI Services (Lovable AI ping). Signed with `apikey` header. 30s soft-cache via table timestamps.
- pg_cron: schedule every 60s calling the probe route.
- `src/routes/status.tsx`: extend existing page to read latest snapshot via new public server fn `getSystemHealth()`; keep existing incidents UI intact. Show per-component pill (healthy/degraded/outage) + last-checked timestamp.

### Sharing (item 4)
- `ShareButtons` already built. Wire into `blog.$slug.tsx` above article body and into `docs.$slug` (if present) — analytics events already fire.

### Contact (item 11)
Copy Email/Website/Phone + toasts already shipped in Wave 1. Add Click-to-email `mailto:` and Click-to-website analytics events (registry entry `email_click`, `website_click`) — hooks already exist; just wire onClick.

### Analytics (item 12)
- Extend `AnalyticsEventName` union with `email_click`, `website_click`, `share_click`, `copy_action` (generic).
- Add `workspace_id` optional field to server fn schema; when authenticated, attach via bearer middleware. Anonymous events remain accepted.
- No provider swap; dataLayer + `analytics_events` table.

### Performance (item 13)
- Add `<Link preload="intent">` to primary nav links in `__root.tsx` (TanStack already supports; verify current setting).
- Move Lucide icons in ShareButtons to per-icon imports (already tree-shaken; verify).
- Add `loading="lazy"` + `decoding="async"` to non-LCP `<img>` on marketing routes; keep hero image eager.
- Verify `preconnect` for Google Fonts in `__root.tsx` head.links.

### Accessibility (item 14)
- Run `axe-core` snapshot test across `/`, `/contact`, `/security`, `/status`, `/pricing`, `/blog`.
- Add `prefers-reduced-motion` guards to any framer-motion / CSS animations on new components.
- Verify focus-visible rings on ShareButtons + copy buttons; add if missing.

### Central Config (items 15–16)
- Add `FUTURE_SOCIAL_PROFILES` to `src/lib/brand.ts` (Product Hunt, Crunchbase, G2, Capterra, Dev.to, Hashnode, Medium) with `enabled: false`. Existing filter already drops disabled entries — zero UI change until flipped.

### Tests (item 17)
Add:
- `src/lib/seo/meta.test.ts` — `buildPageMeta` produces title/description/canonical/og/twitter parity for a fixture route.
- `src/routes/__root.organization-jsonld.test.tsx` — asserts new Organization fields (email, address, foundingDate, both phones).
- `src/lib/seo/breadcrumbs.test.ts` — asserts BreadcrumbList shape + absolute URLs.
- `src/components/share-buttons.test.tsx` — asserts href for each network, copy action fires `share_click`, keyboard activation.
- `tests/e2e/analytics-dispatch.spec.py` — clicks a social link, asserts dataLayer push + Supabase insert into `analytics_events`.
- Extend existing `run_rls_test_suite` with `system_health_probes` cross-tenant read denial.

## Technical section

New files:
- `src/lib/seo/meta.ts`, `src/lib/seo/meta.test.ts`
- `src/routes/api/public/health/probe.ts`
- `src/lib/system-health.functions.ts` (public read)
- Migration: `system_health_probes`, `system_health_history` + GRANTs + RLS + pg_cron schedule
- 5 test files above

Extended (no behavior removed):
- `src/routes/__root.tsx` (Organization graph fields, preconnect audit)
- `src/routes/status.tsx` (probe pills added under existing UI)
- `src/routes/blog.$slug.tsx`, `src/routes/docs.$slug.tsx` (ShareButtons + BreadcrumbList)
- Every top-level public route (`head()` → `buildPageMeta` + breadcrumb script)
- `src/lib/brand.ts` (`FUTURE_SOCIAL_PROFILES`, disabled)
- `src/lib/analytics/events.ts` + `src/lib/analytics.functions.ts` (new event names, optional workspace_id)
- `src/routes/contact.tsx` (email/website click analytics)
- `src/routes/sitemap[.]xml.ts` (audit registry entries)

Deferred (call out explicitly, not built here):
- BYO status-page vendor integration (Instatus/StatusPage) — the probe table is compatible if you later want to switch.
- Per-provider probe timeouts >5s or synthetic browser probes — start with in-worker HTTP probes.

## Verification gate
Before final report: `tsgo --noEmit` clean, all existing 51 tests + new tests pass, `supabase--linter` no new WARN, manual smoke on `/`, `/contact`, `/security`, `/status`, `/blog/[any-post]`.

## Deliverable
Final Implementation Report as requested (files changed, new components/hooks/utils, schema generators, analytics events, structured data, SEO, a11y, perf, test coverage, QA results, remaining blockers if any).

Approve to proceed, or tell me which sections to drop / re-order.
