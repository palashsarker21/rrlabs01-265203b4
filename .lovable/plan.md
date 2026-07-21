## Enterprise App Shell Redesign

Structural navigation/layout overhaul for the entire `_authenticated` area. No business logic, schema, or API changes — routes, server functions, and data flow all stay intact. Only the shell and dashboard composition change.

### 1. New authenticated shell (`src/routes/_authenticated/route.tsx`)

Wrap every authenticated route in a persistent shell using the existing shadcn `Sidebar` primitives:

```text
┌─────────────────────────────────────────────────────────┐
│ TopBar: [☰ mobile] [Workspace ▾] [Search] [+ Create] [🔔] [User ▾] │
├────────────┬────────────────────────────────────────────┤
│ Sidebar    │                                            │
│  Logo      │                                            │
│  Search    │            <Outlet />                      │
│  Nav       │      (independent scroll area)             │
│  groups    │                                            │
│  (collap-  │                                            │
│   sible)   │                                            │
└────────────┴────────────────────────────────────────────┘
```

- Desktop ≥`md`: permanent left sidebar (`collapsible="icon"`), sticky top header, main content scrolls independently.
- Mobile: sidebar becomes an offcanvas drawer via `SidebarTrigger`; top header keeps workspace/search/notifications/user; no bottom nav.
- Sidebar state (expanded groups + collapsed rail) persisted to `localStorage`.
- Active route highlighting via `useRouterState` pathname matching.

### 2. Navigation config (`src/lib/app-nav.ts`)

Single source of truth consumed by sidebar, command palette, and global search. Groups: Dashboard, Recovery, Customers, Orders, Payments, Communication, AI, Automation, Integrations, Analytics, Team, Security, Settings, Support — matching the structure in the request.

- Each item: `{ id, label, to, icon, keywords, badge?, permission?, adminOnly? }`.
- Items filtered by `usePermissions` / `getMyAdminStatus` so users only see what they can open.
- Items that don't yet have a dedicated route point at the nearest existing route (e.g. "Recovery Attempts" → `/events`, "Invoices" → `/billing/statements`, "Prompt Library" → `/admin/v2/ai`). No new feature routes are created — this is a discoverability redesign; existing pages are simply surfaced.

### 3. Top header (`src/components/app-shell/top-bar.tsx`)

Minimal, no duplicate nav:
- Mobile `SidebarTrigger` (hamburger).
- `WorkspaceSwitcher` (reuses current workspace query).
- Global `SearchTrigger` → opens `⌘K` command palette (extends the existing `AdminCommandPalette` pattern into `AppCommandPalette` fed by `app-nav.ts` + recent customers/events).
- `QuickCreateMenu`: Connect Store, Connect Payment, Create Campaign, Invite Member, Send Test Email, Run AI Test — each links to the existing route/dialog that already implements it.
- `NotificationsBell` (existing `listAlerts` + realtime).
- `UserMenu` (profile, security, sign out — existing actions).

### 4. Left sidebar (`src/components/app-shell/app-sidebar.tsx`)

- `BrandLockup` at top.
- Inline workspace switcher (compact).
- Search input that opens the command palette.
- `SidebarGroup` per category with collapsible header; default-open groups derived from active route; state stored per group in `localStorage`.
- Icon-only rail when collapsed; tooltips on hover.

### 5. Dashboard rework (`src/routes/_authenticated/app.tsx`)

Trim to a summary surface — every tile links into the module that owns the detail:

- KPI row: MRR, Recovered Revenue, Recovery Rate, Failed Payments, Recovered Customers, Recovery Queue depth.
- Secondary row: Today's Activity, Active Integrations, AI Status, System Health.
- Recent Events feed (existing `listRecoveryEvents`) with realtime subscription on `recovery_events` — replaces manual refresh.
- Quick Actions card mirroring the top-bar Quick Create.
- Every card is a `Link` to its module; long-form panels (billing, workflow diagram, full event table) move out of the dashboard and stay reachable via their existing routes.

### 6. Live recovery pipeline

Upgrade `RecoveryWorkflowDiagram` to a live pipeline view fed by realtime `recovery_events` + `recovery_attempts` counts (data already exposed by `getRecoveryStats` / `listRecoveryEvents`). Each node shows status, last timestamp, and opens a detail drawer listing the most recent events for that stage. No engine/schema changes.

### 7. Empty states, mobile, performance

- Reuse `EmptyState` primitive everywhere a list can be empty (illustration + description + primary/secondary CTA).
- Mobile: sidebar drawer, single-column dashboard grid, no horizontal scroll; verified with the mobile viewport tool.
- Route-level code splitting stays as TanStack's default; heavy dashboard panels (`RecoveryWorkflowDiagram`, `BillingPanel`) become `React.lazy` behind Suspense so the dashboard shell stays light.

### Files touched

- `src/routes/_authenticated/route.tsx` — swap `<Outlet />` for the new `<AppShell>` wrapper.
- `src/components/app-shell/` (new): `app-sidebar.tsx`, `top-bar.tsx`, `workspace-switcher.tsx`, `quick-create-menu.tsx`, `app-command-palette.tsx`, `nav-config.tsx`.
- `src/lib/app-nav.ts` (new): grouped nav registry.
- `src/routes/_authenticated/app.tsx` — dashboard rewrite (summary-only).
- `src/components/recovery-workflow-diagram.tsx` — live pipeline upgrade.
- Small tweaks to `admin.v2.tsx` so it nests cleanly inside the new shell (drop the duplicate header, keep its admin sub-nav).

### Out of scope

- No new server functions, migrations, RLS, or edge functions.
- No changes to Recovery Engine timing/logic, AI gateway, billing math, or auth flows.
- No new feature pages — every sidebar link resolves to an existing route.

### Rollout

Single PR. Verified by:
1. `bunx tsgo --noEmit` clean.
2. `bun run build` clean.
3. Playwright screenshot of dashboard + `/events` + `/admin/v2` on desktop and 390px mobile viewport.
