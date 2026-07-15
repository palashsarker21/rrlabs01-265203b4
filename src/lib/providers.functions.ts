/**
 * Provider + webhook + limit server functions consumed by the Integration
 * Center. All reads are RLS-scoped to the current user.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getEffectiveLimitsFor } from "./plan-limits.server";
import { webhookUrl } from "./providers/webhook-url";

const workspaceIdSchema = z.object({ workspaceId: z.string().uuid() });
const integrationIdSchema = z.object({ integrationId: z.string().uuid() });

/** Public list of every provider — used to render the Integration Center. */
export const listProviderCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase } = await createPublicClient();
  const { data, error } = await supabase
    .from("provider_catalog")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Effective plan limits for the current workspace. */
export const getWorkspaceLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    return getEffectiveLimitsFor(context.supabase, data.workspaceId);
  });

/** Compute the public webhook URL for an integration. */
export function derivePublishedOrigin(): string {
  return (
    process.env.APP_URL ??
    (process.env.LOVABLE_PROJECT_ID
      ? `https://project--${process.env.LOVABLE_PROJECT_ID}.lovable.app`
      : "https://rrlabs.lovable.app")
  );
}

export const getIntegrationWebhookInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => integrationIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("integrations")
      .select(
        "id, workspace_id, provider, webhook_secret, webhook_verify_token, verification_status, last_test_at, last_test_ok",
      )
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");

    const { data: status } = await context.supabase
      .from("provider_status")
      .select("*")
      .eq("integration_id", row.id)
      .maybeSingle();

    return {
      integrationId: row.id,
      provider: row.provider,
      url: webhookUrl(derivePublishedOrigin(), row.provider, row.id),
      secret: row.webhook_secret ?? null,
      verifyToken: row.webhook_verify_token ?? null,
      verificationStatus: row.verification_status,
      lastTestAt: row.last_test_at,
      lastTestOk: row.last_test_ok,
      status: status ?? null,
    };
  });

/** Rotate the HMAC secret used to sign inbound webhooks. */
export const rotateWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => integrationIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("integrations")
      .select("id, workspace_id")
      .eq("id", data.integrationId)
      .maybeSingle();
    if (!row) throw new Error("Integration not found.");
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission.");

    const newSecret = randomBytes(24).toString("base64url");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integrations")
      .update({ webhook_secret: newSecret })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: row.workspace_id,
      actorId: userId,
      actorEmail: (context.claims as { email?: string })?.email ?? null,
      action: "integration.webhook_rotated",
      targetType: "integration",
      targetId: row.id,
    });

    return { ok: true as const, secret: newSecret };
  });

/** Latest webhook deliveries for a given integration. */
export const listWebhookLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ integrationId: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("webhook_logs")
      .select("*")
      .eq("integration_id", data.integrationId)
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Provider status rows for every integration in a workspace (one call). */
export const listWorkspaceProviderStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("provider_status")
      .select(
        "integration_id, last_delivery_at, last_success_at, last_error, retry_count, verification_status, updated_at, integrations!inner(workspace_id)",
      )
      .eq("integrations.workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      integration_id: r.integration_id,
      last_delivery_at: r.last_delivery_at,
      last_success_at: r.last_success_at,
      last_error: r.last_error,
      retry_count: r.retry_count,
      verification_status: r.verification_status,
      updated_at: r.updated_at,
    }));
  });

/** Reveal the current webhook signing secret. Requires manage permission. */
export const revealWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => integrationIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("integrations")
      .select("id, workspace_id, webhook_secret, webhook_verify_token")
      .eq("id", data.integrationId)
      .maybeSingle();
    if (!row) throw new Error("Integration not found.");
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission.");
    return {
      secret: row.webhook_secret ?? null,
      verifyToken: row.webhook_verify_token ?? null,
    };
  });




// -----------------------------------------------------------------
// Helper: a publishable-key server client for public catalog reads.
// -----------------------------------------------------------------
async function createPublicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  return { supabase };
}
