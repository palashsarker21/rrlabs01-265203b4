## Platform Control Center — Separation & Enterprise Upgrade

This is a large structural change. I'll ship it in ordered waves so nothing breaks, keeping all existing DB, APIs, and business logic intact.

### Wave 1 — Route & Shell Separation

- Move admin surface from `/admin/*` and `/admin/v2/*` to a new top-level `/platform/*` tree with its own layout (`src/routes/_authenticated/platform/route.tsx`).
- Keep `/admin/*` routes alive as thin redirects to their `/platform` equivalents (no broken bookmarks, no lost audit trails).
- Add `/platform` to `BYPASS_PREFIXES` in `app-shell.tsx` so the customer chrome never leaks in. Platform gets its own shell: `PlatformShell` (sidebar + top bar + status bar), Customer keeps `AuthenticatedShell`.
- Customer sidebar (`app-nav.ts`) loses every admin-only entry; those live only in the platform nav registry.

### Wave 2 — Platform Shell Chrome

- `src/components/platform/platform-shell.tsx` — layout wrapper.
- `src/components/platform/platform-sidebar.tsx` — collapsible module groups, persisted expand state (`localStorage`), keyboard nav, active-route highlight, live badge slots.
- `src/components/platform/platform-topbar.tsx` — Global Create dropdown, Command Palette trigger, Organization Switcher (impersonation entry point), profile menu.
- `src/components/platform/system-status-bar.tsx` — always-visible strip with 8 service pills (API, DB, Queues, Workers, AI, Email, WhatsApp, Payments) fed by `getSystemHealth`.
- `src/components/platform/impersonation-banner.tsx` — sticky banner when viewing a workspace as admin, with "Exit" action.

### Wave 3 — Nav Registry + Live Badges + Command Palette

- New `src/lib/platform/nav.ts` — module-grouped registry (Monitoring, Customers, Revenue, Operations, Messaging, Content, Platform, Security, God Mode). Reuses existing `ADMIN_NAV` labels and destinations, just retargeted to `/platform/*`.
- `src/lib/platform/badges.functions.ts` — `getPlatformBadges` server fn returning counts for Failed Jobs, Pending Emails, Pending WhatsApp, Webhook Failures, Open Incidents, New Tickets. Wired via `useQuery` with 30 s refetch + Supabase Realtime invalidation.
- Reuse existing `AppCommandPalette` pattern in `src/components/platform/command-palette.tsx`, scoped to platform nav plus entity search (orgs, users, invoices, recovery events, audit logs, queues, API keys, routes, integrations).

### Wave 4 — Global Create + Impersonation

- `src/components/platform/create-menu.tsx` — dropdown with the 9 create actions. Each opens the existing creation dialog/route (New Organization → workspaces admin flow, etc.). No new business logic.
- Secure impersonation via existing `admin_workspace_overview` gate: `startImpersonation(workspaceId)` server fn (super_admin only, audited), sets a signed cookie/session flag read by `impersonation-banner`. "Exit" clears it. All impersonated reads still go through RLS as the admin user; we just scope the active workspace context — never a customer session token.

### Wave 5 — Dangerous Actions + Audit

- `src/components/platform/confirm-dangerous.tsx` — dialog requiring password re-entry (via `supabase.auth.signInWithPassword` re-check) or MFA challenge before running delete/suspend/refund/plan-change/god-mode actions.
- Every platform server fn calls `writeAuditLog` (already exists in `src/lib/audit.server.ts`) with actor, IP, UA, old/new value, reason. Add a `reason` text field to dangerous-action dialogs.

### Wave 6 — Dashboard, Empty States, God Mode

- Rewrite `/platform` index (`platform.index.tsx`) with the 17 KPI cards, all sourced from existing analytics/billing/system-health server fns. No placeholders — when a metric returns null, show "No data yet" + CTA.
- Standard `<EmptyState />` primitive with explanation + CTA + docs link + example data toggle. Applied to every list route.
- God Mode section only rendered when `isSuperAdmin && email === 'palashsarker1993@gmail.com'`. Confirmation + audit for every action.

### Wave 7 — Responsive, Perf, Cleanup

- Sidebar: desktop collapsible, tablet auto-collapsed, mobile drawer (Sheet).
- Route-level lazy loading for platform pages via TanStack code-splitting (already default).
- Virtualized tables (`@tanstack/react-virtual`, already installed) for customer directory, audit logs, recovery events.
- Server-side pagination on all list fetchers.
- Remove hardcoded stats from existing admin panels; replace with live queries.

### What stays untouched

- Database schema, RLS policies, RBAC helpers.
- All server functions and webhook handlers.
- Recovery engine, AI gateway, billing, email/WhatsApp adapters.
- Customer-facing routes and shell.

### Technical notes

- `/admin/*` → `/platform/*` redirects live in the old route files as `beforeLoad: () => redirect(...)`, preserving deep links (`?tab=` params carry over).
- Sidebar expand state persisted per user under `localStorage["platform.nav.collapsed"]`.
- Badges use a single `useQuery(["platform-badges"])` fed by one aggregated server fn to avoid N queries.
- Status bar polls `getSystemHealth` every 60 s + realtime channel on `incidents` for immediate red-state flips.
- Impersonation uses an httpOnly cookie `platform_impersonating_workspace` set by a server fn; middleware refuses to set it for non-super-admins.

### Rollout order (single PR chain)

1. Wave 1 + 2 (shell + redirects) — safe, no data change.
2. Wave 3 (nav, badges, palette).
3. Wave 4 (create menu, impersonation).
4. Wave 5 (dangerous-action guard + audit hooks).
5. Wave 6 (dashboard, empty states, god mode).
6. Wave 7 (responsive polish, virtualization, cleanup of legacy hardcoded values).

Shall I proceed starting with Wave 1?
