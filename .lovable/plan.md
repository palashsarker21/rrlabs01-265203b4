
# Super Admin Console — Production Expansion Plan

Expand the existing Admin Console (`/admin`, current tabs: Workspaces, Audit, Pricing, Features) into a full enterprise operations center with 20 modules, without redesigning the UI shell or breaking existing tabs.

## Approach

- **Reuse the existing tabbed shell** in `src/routes/_authenticated/admin.tsx`. Each new module is a new tab (or grouped sub-tab), rendered as a lazy component under `src/components/admin/<module>/`.
- **All data server-driven** via new `*.functions.ts` files with `requireSupabaseAuth` + `assertSuperAdmin` on every read/write. No hardcoded rows.
- **Shared primitives** (`src/components/admin/_shared/`):
  - `DataTable` — search, column filters, sort, pagination (server- or client-side), CSV/XLSX export via a tiny in-house csv encoder (no new deps beyond `xlsx` if excel is required — else CSV only).
  - `ConfirmDialog` — required wrapper for every destructive action.
  - `AuditedButton` — writes to `audit_logs` via `writeAuditLog` on click.
- **RBAC/RLS preserved** — every server fn re-checks `is_super_admin`; no bypass of RLS except through existing `supabaseAdmin` for read-only aggregations and moderation writes that already have policies.

## Modules (20)

Each ships as a tab with list + detail drawer, standardized toolbar (search / filter / sort / paginate / export), and audit-logged mutations.

1. **Workspaces** — extend current tab: add filter by status/plan, per-row detail drawer with members, integrations, subs, engine toggle, suspend, impersonate-view (read-only).
2. **Users & Roles** — list `profiles` + `user_roles`, grant/revoke `super_admin`/`admin`, force sign-out, delete user (admin API).
3. **Subscriptions** — `subscriptions` join `plans` + `workspaces`, filter by status, cancel/reactivate, sync-from-LemonSqueezy button.
4. **Billing Ops** — `billing_events` + `checkout_sessions`, replay failed webhooks, refund lookup, MRR/ARR panel (already partially exists).
5. **Webhook Monitor** — `webhook_logs` + `billing_events`, filter provider/status, retry button, payload viewer.
6. **Integrations** — `integrations` cross-workspace, filter provider/status, force-disconnect, rotate secret.
7. **Recovery Engine** — `recovery_events` + `recovery_attempts`, per-workspace throughput, pause/resume, requeue.
8. **AI Usage** — aggregate from `ai_gateway` logs via existing tool (read-only panel).
9. **Email Queue** — `notification_logs` where channel=email, retry, view body.
10. **WhatsApp Queue** — `notification_logs` where channel=whatsapp, retry, view body.
11. **Audit Logs** — extend current tab with search/filter by action/actor/workspace/date, CSV export.
12. **Security Center** — surfaces `security--get_scan_results` + user_roles anomalies + failed sign-ins summary.
13. **Support Center** — `contact_leads` inbox, assign/close, notes.
14. **Blog & CMS** — link out to existing blog admin; add moderation queue (`blog_posts` where status=pending).
15. **System Health** — `provider_status`, DB latency, edge fn health, cron heartbeat.
16. **Global Settings** — new `admin_settings` key/value table (migration), edited via form.
17. **Feature Flags** — extend current tab with per-workspace overrides UI, search.
18. **Provider Catalog** — extend current tab with sort_order editor, beta toggle, docs URL edit.
19. **Maintenance** — `maintenance_mode` flag, cache invalidate, expire trial workspaces (call existing `expire_trial_workspaces` RPC).
20. **Analytics** — MRR/ARR/churn/recovered revenue/webhook health (extend existing billing metrics panel).

## New database objects (single migration)

- `admin_settings` (key text pk, value jsonb, updated_at, updated_by) — for Global Settings module.
- No new columns on existing tables. All other modules read tables that already exist.
- GRANTs to `service_role` only; RLS: super_admin read/write via `is_super_admin(auth.uid())`.

## New server functions

Grouped under `src/lib/admin/`:

- `users.functions.ts` — `listUsers`, `grantRole`, `revokeRole`, `forceSignOut`, `deleteUser`.
- `subscriptions.functions.ts` — `listSubscriptions`, `cancelSubscription`, `reactivateSubscription`, `syncFromLemonSqueezy`.
- `webhooks.functions.ts` — `listWebhookLogs`, `retryWebhook`.
- `integrations.functions.ts` — `listAllIntegrations`, `forceDisconnect`.
- `recovery.functions.ts` — `listRecoveryEvents`, `requeueAttempt`, `pauseWorkspaceEngine`.
- `notifications.functions.ts` — `listNotifications`, `retryNotification`.
- `support.functions.ts` — `listContactLeads`, `updateLeadStatus`.
- `health.functions.ts` — `getSystemHealth`.
- `settings.functions.ts` — `getSettings`, `setSetting`.
- `maintenance.functions.ts` — `setMaintenanceMode`, `expireTrials`, `invalidateCache`.

Every fn: `requireSupabaseAuth` middleware → `assertSuperAdmin` guard → paginated query → returns `{ rows, total }`.

## Shared UI

- `src/components/admin/_shared/data-table.tsx` — column defs, server pagination, CSV export.
- `src/components/admin/_shared/confirm-dialog.tsx` — used by all destructive actions.
- `src/components/admin/_shared/export-menu.tsx` — CSV (always) + XLSX (via `xlsx` dep, added).

## Non-goals

- No visual redesign — same header, tab strip, table styling, colors.
- No new pricing plans, no changes to customer-facing flows.
- No changes to RLS policies of existing tables (only add policies on new `admin_settings`).
- No removal of any working feature.

## Verification

- `bunx tsgo --noEmit` clean.
- `bun run build` clean.
- Manual spot-check via preview: each tab loads, search/filter works, CSV export downloads, confirm dialog blocks destructive click.

## Scope note

This is roughly **~40 new files (~4-5K LOC)** and **1 migration**. It will take multiple turns to implement. I'll ship module-by-module with the shared table primitive first, then modules 1-5, 6-10, 11-15, 16-20 as batches. Nothing user-facing changes until the first batch merges.

Approve to proceed with **Batch 1: shared primitives + migration + modules 1-5 (Workspaces detail, Users, Subscriptions, Billing Ops, Webhook Monitor)**.
