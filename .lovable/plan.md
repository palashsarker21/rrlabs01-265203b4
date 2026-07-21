# Live Support & Messaging Center — Delivery Plan

Audit-first, extend-only. No existing chat/notification code is replaced. Delivered in 5 waves so each is reviewable, backwards-compatible, and production-safe.

## Audit findings (current state)

- **No existing support/chat tables** — `support_*` namespace is unused. Nothing to preserve or migrate.
- **Notifications**: `notification_logs`, `notification_preferences`, `alerts` exist and drive the header bell. Support will emit into these; not replaced.
- **Roles**: `app_role` enum + `user_roles` + `has_role()` already exist (`super_admin` present). Missing: `support_agent`, `moderator`. `workspace_role` (owner/admin/manager/member) handles customer-side gating.
- **Realtime**: Supabase Realtime is wired and already used on the Integrations page. Same pattern reused.
- **Auth/RLS**: `_authenticated/route.tsx` gate + `requireSupabaseAuth` middleware + bearer attacher in `src/start.ts` are in place.
- **AI**: Lovable AI Gateway server helper exists — reused for auto-tagging + close-summary.
- **Storage**: `blog-media` bucket exists (private). New `support-attachments` bucket added.
- **UI primitives**: shadcn + AI Elements-style primitives, `PageHeader`, `StatCard`, header bell all reusable.

## Waves

### Wave 1 — Schema, RLS, routing engine (server)

- Migration adds `support_agent` + `moderator` to `app_role` enum.
- New tables (all with GRANTs + RLS + `service_role` full access + `authenticated` scoped policies):
  `support_conversations`, `support_messages`, `support_participants`, `support_presence`, `support_assignments`, `support_tags`, `support_conversation_tags`, `support_internal_notes`, `support_attachments`, `support_feedback`, `support_activity_logs`.
- Enums: `support_status` (open/pending/waiting/resolved/closed/archived), `support_priority` (low..critical), `support_category` (10 values from spec), `support_presence_status` (online/available/busy/away/offline), `support_message_kind` (text/system/note), `support_delivery_status` (sending/sent/delivered/seen/failed).
- `support-attachments` private storage bucket + signed-URL server fn.
- Helper fns: `is_support_staff(uid)`, `can_view_conversation(uid, conv_id)`, `next_support_assignee()` (agents → admins → moderators → super-admin, filtered by presence).
- Server fns in `src/lib/support/*.functions.ts`: `startConversation`, `sendMessage`, `markSeen`, `setTyping`, `setPresence`, `assignConversation`, `transferConversation`, `closeConversation`, `reopenConversation`, `submitFeedback`, `addInternalNote`, `uploadAttachment` (signed URL), `listMyConversations`, `getConversation`, `searchMessages`, `staffInboxList`, `staffInboxMetrics`.
- Auto-response system message when queue is empty; SLA fields stamped on each message/assignment.
- Realtime publication `ADD TABLE` for all support tables.

### Wave 2 — Customer chat UI

- New route `src/routes/_authenticated/support.tsx` — conversation list + active thread.
- Floating support widget component available on every authenticated page (opt-in via header).
- Message composer with attachments, emoji picker, sending/sent/delivered/seen badges, typing indicator, auto-scroll, unread badge.
- Presence + typing via Supabase Realtime broadcast/presence channels.
- Feedback modal on close (5-star + comment + preset options).
- WCAG 2.2 AA: focus rings, keyboard shortcuts (Enter send, Shift+Enter newline, Esc close), aria-live for new messages, screen-reader labels for status pills.

### Wave 3 — Staff inbox

- New route group `src/routes/_authenticated/admin/support/`:
  - `index.tsx` — inbox with filters (status, priority, category, assignee, unassigned, tags, search).
  - `$conversationId.tsx` — full thread with internal-notes tab, transfer/assign controls, priority/category/tags, customer profile side panel.
- Gate: `has_role(uid, 'support_agent') OR has_role(uid, 'moderator') OR has_role(uid, 'admin') OR is_super_admin(uid)`.
- Metrics header: open, waiting, assigned to me, unassigned, avg first-response, avg resolution, CSAT.
- Presence toggle for staff (online/available/busy/away).

### Wave 4 — AI + SLA

- Auto-tagging (Lovable AI, `google/gemini-3-flash-preview`) on first customer message → sets `category` + inserts tags. Structured output with Zod.
- Close-summary AI job (problem / root cause / resolution / duration / category / agent) stored on the conversation row.
- SLA computation server fn: first-response, avg response, resolution, waiting time. Rolled into `staffInboxMetrics`.
- Alerts: new-conversation, SLA-breach, mention-in-internal-note.

### Wave 5 — Notifications, attachments, tests, hardening

- Emit into existing `notification_logs` + header bell (new-message, assigned, transferred, closed).
- Browser Notification API + optional desktop toast (existing pattern).
- Rate limiting on `sendMessage` (server-fn in-process leaky bucket keyed by `userId`) + attachment size cap (10MB) + MIME allowlist.
- XSS: messages render as text; markdown passes through DOMPurify.
- Audit rows into `support_activity_logs` on every state change.
- Tests (`vitest` + jsdom):
  - Routing engine unit tests (agent → admin → moderator → super-admin fallback + queued when nobody online).
  - Message send + optimistic status transitions.
  - Typing indicator debounce.
  - Seen-receipt fan-out.
  - Attachment MIME/size validation.
  - Feedback insert respects RLS (customer can insert once, staff cannot spoof).
  - Internal-note RLS (customer cannot read).

## Technical notes

- Realtime: postgres_changes for durable state (messages, conversation, assignments); presence channels for typing + online status (no DB writes per keystroke).
- Storage: private bucket, download via signed URL from a `requireSupabaseAuth` server fn that checks `can_view_conversation`.
- No new edge functions — all server logic via `createServerFn` per stack rules.
- Backward compatible: no existing tables touched, no existing routes changed. Support widget rendered opt-in.

## Files (high-level)

- Migrations: 1 combined migration for Wave 1.
- Server: `src/lib/support/{conversations,messages,presence,assignments,ai,attachments}.functions.ts`, `src/lib/support/routing.ts` (+ unit tests).
- UI: `src/routes/_authenticated/support.tsx`, `src/routes/_authenticated/admin/support/index.tsx`, `src/routes/_authenticated/admin/support/$conversationId.tsx`, `src/components/support/*` (widget, thread, composer, message-bubble, presence-dot, typing-indicator, feedback-dialog, attachment-preview).

## Approval

Reply **"Approve Wave 1"** to run the migration + backend routing engine, or ask me to reorder / trim scope.
