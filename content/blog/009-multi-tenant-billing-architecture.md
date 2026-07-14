---
title: "Multi-Tenant Billing Architecture: How RRLabs Isolates Every Workspace's Payment Data"
slug: "multi-tenant-billing-architecture"
description: "A deep look at how RRLabs designs multi-tenant billing infrastructure — workspace scoping, row-level security, encrypted credentials, and the failure modes we design against."
keywords: ["multi-tenant billing", "workspace isolation", "row level security", "saas architecture", "postgres rls"]
category: "Engineering"
tags: ["Architecture", "Multi-Tenant", "Security", "Postgres", "RLS"]
author: "RRLabs Engineering"
publishDate: "2026-06-29"
lastModified: "2026-07-14"
featured: false
imageAlt: "Multi-tenant billing data model with workspace-scoped RLS"
seoTitle: "Multi-Tenant Billing Architecture — Workspace Isolation Done Right"
seoDescription: "How RRLabs builds isolated multi-tenant billing infrastructure with row-level security and encrypted credentials."
ogTitle: "Multi-Tenant Billing Architecture"
ogDescription: "Workspace scoping, RLS, encrypted credentials — the RRLabs stack, explained."
twitterTitle: "Multi-Tenant Billing Architecture"
twitterDescription: "How to isolate every workspace's payment data — the details."
---

Multi-tenant billing infrastructure is deceptively hard. The data model is simple. The **isolation invariants** are unforgiving. If Workspace A ever sees a single row from Workspace B's recovery events, you have a data breach. The margin for error is zero.

Here's how RRLabs designs for that.

## The data model, briefly

Every tenant-owned table has `workspace_id uuid not null` as the isolation boundary. Not `user_id`, not `organization_id` — **workspace**. Users can belong to multiple workspaces; billing data lives at the workspace layer.

The typical structure:

```
organizations
  ↳ workspaces
     ↳ workspace_members (user_id, role)
     ↳ integrations         (workspace_id, provider, credentials_encrypted)
     ↳ recovery_events      (workspace_id, invoice_id, ...)
     ↳ recovery_attempts    (workspace_id, event_id, ...)
     ↳ audit_logs           (workspace_id, actor_id, ...)
```

Every foreign key upward is checked; every row carries its own `workspace_id` denormalized so RLS can enforce isolation without joins.

## Row-Level Security is the load-bearing feature

Application code has bugs. Application code will eventually query the wrong workspace. **The database has to be the final line of defense.**

Every tenant table has RLS enabled with policies that scope reads and writes to workspaces the current auth user belongs to:

```sql
create policy "workspace members read own workspace events"
  on public.recovery_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = recovery_events.workspace_id
        and m.user_id = auth.uid()
    )
  );
```

This runs on every SELECT. It's slower than not having RLS. It is not slow enough to matter for anyone building a real product.

:::warning
Never write RLS policies with subqueries that call SECURITY INVOKER functions on the same table. Infinite recursion, and every query on the table returns 500. Use SECURITY DEFINER helper functions or `EXISTS` on membership tables.
:::

## Credentials are encrypted server-side, always

Integration credentials (Stripe API keys, WhatsApp tokens, Resend keys) are the highest-risk data in the system. They:

- Live in the `integrations` table, in a `credentials_encrypted` column.
- Are encrypted with AES-256-GCM using a workspace-scoped key derived from a master KMS key.
- Are decrypted **only inside privileged server functions**, never returned to the browser.
- Have a redacted display representation (`sk_live_***abc`) for the UI.

The failure mode we design against: a compromised frontend session should never be able to exfiltrate a Stripe secret. Even a compromised app-server session should require both database access and KMS access to decrypt.

## Super-admin access is a separate role, not a super-user

RRLabs' admin console — the one that shows workspace overviews across tenants — is gated by a `super_admin` role stored in a **separate `user_roles` table**, checked via a SECURITY DEFINER function. Roles on the profile table are a privilege-escalation pattern; a user can update their own profile.

```sql
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

Every admin RLS policy calls `public.has_role(auth.uid(), 'super_admin')`. A user has no direct write path to `user_roles`.

## Audit logs are append-only

Every meaningful action — engine toggled, integration connected, credentials rotated, a recovery attempt manually retried — writes to `audit_logs`. Table is INSERT-only for authenticated roles; DELETE is denied.

The value is not the raw log. The value is: **when something goes wrong, you can reconstruct exactly what happened, by whom, and when**. That capability changes how confidently you operate.

## Failure modes we design against

- **Cross-workspace query bugs.** RLS catches these.
- **Compromised session tokens.** RLS scopes them to their own workspace anyway.
- **Compromised admin sessions.** Audit log surfaces suspicious sequences.
- **Provider secret leakage.** Encrypted at rest, decrypted only server-side.
- **Backup restore to wrong environment.** Encrypted keys don't work across environments — even a full DB dump restored to the wrong place is useless without the KMS key.

## What we don't do

- **Row-level tenant isolation by schema-per-tenant.** Ops complexity is not worth it under 10K tenants.
- **Physical DB isolation per tenant.** Same reason.
- **Vault-per-request decryption.** Adds 40ms to every read; RLS-backed columns are enough.

## The one thing worth over-engineering

Isolation. There is no operational cost that is not worth paying to ensure Workspace A cannot see Workspace B's data. Everything else in a multi-tenant billing system is a tradeoff. Isolation is not.
