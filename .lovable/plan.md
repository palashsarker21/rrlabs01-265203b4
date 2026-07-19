# Enterprise Public-Site Upgrade — Plan

Audit-first. Extend existing code; never rebuild working behavior.

## Wave 1 — shipped now
- Extend Organization JSON-LD (legalName, description, image, serviceType, areaServed).
- WebSite JSON-LD SearchAction (already had WebSite entity — add potentialAction).
- Central breadcrumb generator (`src/lib/seo/breadcrumbs.ts`) — reusable by every leaf route.
- Share bar component (LinkedIn, X, Facebook, Threads, Copy Link) with analytics.
- Analytics events registry + client (`src/lib/analytics/events.ts`) — dataLayer push + persistence.
- `analytics_events` table + RLS + admin read policy.
- Contact page: Copy Email + Copy Website (Copy Phone already existed) + click analytics on tel/mailto/website.
- Social/Phone link analytics wired.
- Trust Center: extended `/security` route with Platform Security, Privacy, Encryption, Infrastructure, Data Protection, Responsible Disclosure, Subprocessors, Compliance Roadmap ("planned / in progress" — no dates), Incident History ("No reportable incidents to date"), Backup Strategy, Disaster Recovery, plus BreadcrumbList JSON-LD.
- Sitemap already registry-driven — verified.
- robots.txt already correct (Allow public + Disallow private + AI bots + Sitemap directive) — verified.

## Wave 2 — deferred (requires user sign-off on scope; each is 1–2 days of work)
- **Full live-probe Status system** (15+ components, 30s cache, history, alerts, retries, individual timeouts, per-provider dry-runs). Requires new probe framework, `system_health` table, cron scheduler, provider probe modules. The existing `/api/public/health` + `/status` page is left untouched.
- Per-blog-post BreadcrumbList emission (helper is ready; wiring per-route is mechanical).
- Route-level share buttons on `blog.$slug` and docs pages.
- E2E tests for share/copy/analytics event dispatch.
- Prefetch tuning + font-display swap audit.

## Company metadata
User did not supply foundingDate/founder/areaServed/serviceType overrides. Using safe defaults: `areaServed: "Worldwide"`, `serviceType: "Revenue Recovery SaaS"`. foundingDate + founder omitted (will not fabricate).
