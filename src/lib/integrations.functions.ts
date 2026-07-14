import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADAPTERS, getAdapterInfo } from "./integrations/catalog";

const workspaceIdSchema = z.object({ workspaceId: z.string().uuid() });

/** Public catalog — safe metadata, no secrets. */
export const listAdapterCatalog = createServerFn({ method: "GET" }).handler(async () => ADAPTERS);

/** List a workspace's integrations (no secrets — only public config + status). */
export const listWorkspaceIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("integrations")
      .select(
        "id, workspace_id, kind, provider, display_name, status, config, health, last_verified_at, last_error, created_at, updated_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const saveInput = z.object({
  workspaceId: z.string().uuid(),
  provider: z.string().min(1),
  displayName: z.string().max(80).optional(),
  credentials: z.record(z.string(), z.string()),
});

/**
 * Save integration credentials (encrypted) after successfully testing them.
 * Flow: test → encrypt → upsert with status=connected & health=healthy.
 * On failure, upsert with status=error and last_error so the UI can retry.
 */
export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => saveInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const info = getAdapterInfo(data.provider);
    if (!info) throw new Error(`Unknown integration: ${data.provider}`);

    // Authorization: caller must be a workspace member with manage rights.
    const { data: canManage, error: roleErr } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!canManage) throw new Error("You do not have permission to change integrations for this workspace.");

    // Validate required fields per catalog.
    for (const field of info.fields) {
      if (field.required && !data.credentials[field.key]?.trim()) {
        throw new Error(`${field.label} is required.`);
      }
    }

    // Test against upstream provider.
    const { getAdapter } = await import("./integrations/registry.server");
    const adapter = getAdapter(data.provider);
    const result = await adapter.test(data.credentials);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    if (!result.ok) {
      // Persist failure so the operator sees the last error without leaking secrets.
      await supabaseAdmin
        .from("integrations")
        .upsert(
          {
            workspace_id: data.workspaceId,
            kind: info.kind,
            provider: info.provider,
            display_name: data.displayName ?? info.name,
            status: "error",
            health: "unhealthy",
            last_error: result.message,
            config: {},
          },
          { onConflict: "workspace_id,kind,provider" },
        );
      return { ok: false as const, message: result.message };
    }

    // Encrypt credentials.
    const { encryptJSON } = await import("./crypto.server");
    const ciphertext = encryptJSON(data.credentials);

    const { error: upErr } = await supabaseAdmin
      .from("integrations")
      .upsert(
        {
          workspace_id: data.workspaceId,
          kind: info.kind,
          provider: info.provider,
          display_name: data.displayName ?? info.name,
          status: "connected",
          health: "healthy",
          config: (result.publicConfig ?? {}) as never,
          credentials_ciphertext: ciphertext,
          last_verified_at: nowIso,
          last_error: null,
        },
        { onConflict: "workspace_id,kind,provider" },
      );
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const, message: result.message };
  });

const idInput = z.object({ integrationId: z.string().uuid() });

/** Re-test a stored integration (decrypt → adapter.test → update health). */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => idInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("integrations")
      .select("id, workspace_id, provider, credentials_ciphertext")
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to test this integration.");
    if (!row.credentials_ciphertext) throw new Error("This integration has no stored credentials.");

    const { decryptJSON } = await import("./crypto.server");
    const creds = decryptJSON<Record<string, string>>(row.credentials_ciphertext);
    const { getAdapter } = await import("./integrations/registry.server");
    const result = await getAdapter(row.provider).test(creds);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("integrations")
      .update({
        status: result.ok ? "connected" : "error",
        health: result.ok ? "healthy" : "unhealthy",
        last_verified_at: new Date().toISOString(),
        last_error: result.ok ? null : result.message,
        ...(result.ok && result.publicConfig ? { config: result.publicConfig as never } : {}),
      })
      .eq("id", row.id);

    return { ok: result.ok, message: result.message };
  });

/** Disconnect: wipe ciphertext, drop status to disconnected, keep audit row. */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => idInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("integrations")
      .select("id, workspace_id")
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: row.workspace_id,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to disconnect this integration.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("integrations")
      .update({
        status: "disconnected",
        health: null,
        credentials_ciphertext: null,
        last_error: null,
      })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });

/** Mark a workspace ready and turn on the recovery engine. */
export const activateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceIdSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to activate this workspace.");

    // Require at least one payment_gateway AND one communication channel connected.
    const { data: integrations, error } = await supabase
      .from("integrations")
      .select("kind, status")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);

    const connected = (integrations ?? []).filter((i) => i.status === "connected");
    const hasPayment = connected.some((i) => i.kind === "payment_gateway");
    const hasComms = connected.some((i) => i.kind === "communication");
    if (!hasPayment) throw new Error("Connect a payment gateway before activating.");
    if (!hasComms) throw new Error("Connect at least one communication channel before activating.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("workspaces")
      .update({
        status: "active",
        recovery_engine_enabled: true,
        setup_step: 4,
        setup_completed_at: new Date().toISOString(),
      })
      .eq("id", data.workspaceId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const };
  });

/** Update setup progress (used by the wizard to track which step the user is on). */
export const setSetupStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ workspaceId: z.string().uuid(), step: z.number().int().min(0).max(4) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canManage) throw new Error("Not permitted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("workspaces").update({ setup_step: data.step }).eq("id", data.workspaceId);
    return { ok: true as const };
  });
