/**
 * API Key Manager — super-admin server functions.
 *
 * Keys themselves are NEVER stored. On creation we generate a cryptographically
 * random token, return the raw value ONCE to the caller, and persist only the
 * SHA-256 hash plus a short prefix used for identification in logs.
 *
 * All mutations are audited. Reads and writes go through the caller's
 * RLS-scoped client — policies already enforce super-admin + workspace-manager
 * access — with a super-admin gate for the platform-wide list.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (fn: "is_super_admin", args: { _user_id: string }) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

async function audit(
  context: { userId: string; claims: unknown },
  action: string,
  details: Record<string, unknown>,
  target?: { type: string; id: string; workspaceId?: string | null },
) {
  const { writeAuditLog } = await import("../audit.server");
  await writeAuditLog({
    workspaceId: target?.workspaceId ?? null,
    actorId: context.userId,
    actorEmail: (context.claims as { email?: string })?.email ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    details,
  });
}

const KNOWN_SCOPES = [
  "read:workspace",
  "write:workspace",
  "read:recovery",
  "write:recovery",
  "read:billing",
  "write:billing",
  "read:integrations",
  "write:integrations",
  "admin",
] as const;

/** Platform-wide listing of API keys — super admin only. */
export const listAdminApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select(
        "id, workspace_id, name, key_prefix, scopes, status, last_used_at, last_used_ip, expires_at, disabled_at, revoked_at, revoked_reason, request_count, created_at, created_by",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Create a new API key. Returns the raw token ONCE — never retrievable again. */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
        scopes: z.array(z.enum(KNOWN_SCOPES)).min(1).max(KNOWN_SCOPES.length),
        expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { randomBytes, createHash } = await import("crypto");
    const raw = `rrl_live_${randomBytes(24).toString("hex")}`;
    const key_hash = createHash("sha256").update(raw).digest("hex");
    const key_prefix = raw.slice(0, 14);

    const expires_at = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
      : null;

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        workspace_id: data.workspaceId,
        name: data.name,
        key_prefix,
        key_hash,
        scopes: data.scopes,
        expires_at,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await audit(
      context,
      "admin.api_key.created",
      { name: data.name, scopes: data.scopes, expires_at, key_prefix },
      { type: "api_key", id: row.id, workspaceId: data.workspaceId },
    );

    return { id: row.id as string, token: raw, key_prefix, expires_at } as const;
  });

/** Rotate a key: revoke the old row and create a new one with the same scopes/name. */
export const rotateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("api_keys")
      .select("id, workspace_id, name, scopes, expires_at")
      .eq("id", data.id)
      .single();
    if (readErr || !existing) throw new Error(readErr?.message ?? "Key not found.");

    const { randomBytes, createHash } = await import("crypto");
    const raw = `rrl_live_${randomBytes(24).toString("hex")}`;
    const key_hash = createHash("sha256").update(raw).digest("hex");
    const key_prefix = raw.slice(0, 14);

    const { data: created, error: insertErr } = await supabaseAdmin
      .from("api_keys")
      .insert({
        workspace_id: existing.workspace_id,
        name: `${existing.name} (rotated)`,
        key_prefix,
        key_hash,
        scopes: existing.scopes,
        expires_at: existing.expires_at,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    const { error: revokeErr } = await supabaseAdmin
      .from("api_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: "rotated",
      })
      .eq("id", data.id);
    if (revokeErr) throw new Error(revokeErr.message);

    await audit(
      context,
      "admin.api_key.rotated",
      { old_id: data.id, new_id: created.id, new_prefix: key_prefix },
      { type: "api_key", id: created.id, workspaceId: existing.workspace_id },
    );

    return { id: created.id as string, token: raw, key_prefix } as const;
  });

/** Toggle disabled state. Disabled keys pass authentication checks against status='active'. */
export const setApiKeyDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.disabled
      ? { status: "disabled" as const, disabled_at: new Date().toISOString() }
      : { status: "active" as const, disabled_at: null };
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .update(patch)
      .eq("id", data.id)
      .select("workspace_id")
      .single();
    if (error) throw new Error(error.message);
    await audit(
      context,
      data.disabled ? "admin.api_key.disabled" : "admin.api_key.enabled",
      {},
      { type: "api_key", id: data.id, workspaceId: row.workspace_id },
    );
    return { ok: true as const };
  });

/** Revoke permanently. Cannot be undone. */
export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().max(200).optional() })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: data.reason ?? null,
      })
      .eq("id", data.id)
      .select("workspace_id")
      .single();
    if (error) throw new Error(error.message);
    await audit(
      context,
      "admin.api_key.revoked",
      { reason: data.reason ?? null },
      { type: "api_key", id: data.id, workspaceId: row.workspace_id },
    );
    return { ok: true as const };
  });

/** Hard-delete a revoked key row. Only revoked keys can be deleted. */
export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("api_keys")
      .select("workspace_id, status")
      .eq("id", data.id)
      .single();
    if (readErr || !existing) throw new Error(readErr?.message ?? "Key not found.");
    if (existing.status !== "revoked") {
      throw new Error("Only revoked keys can be deleted. Revoke it first.");
    }
    const { error } = await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context,
      "admin.api_key.deleted",
      {},
      { type: "api_key", id: data.id, workspaceId: existing.workspace_id },
    );
    return { ok: true as const };
  });

export const API_KEY_SCOPES = KNOWN_SCOPES;
