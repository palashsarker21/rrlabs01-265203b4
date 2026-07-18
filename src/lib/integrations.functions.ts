import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADAPTERS, getAdapterInfo } from "./integrations/catalog";
import { assertCanConnect, PlanLimitError } from "./plan-limits.server";
import { integrationKindFor, type ProviderKind } from "./providers/kinds";
import { fail, type SaveResult } from "./integrations/errors";

const workspaceIdSchema = z.object({ workspaceId: z.string().uuid() });

/** Public catalog — safe metadata, no secrets. Legacy in-code catalog. */
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
        "id, workspace_id, kind, provider, provider_account_id, display_name, status, config, health, verification_status, last_verified_at, last_test_at, last_test_ok, last_error, created_at, updated_at",
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

    // Resolve provider metadata: prefer DB catalog (source of truth); fall
    // back to in-code catalog for legacy providers not yet in the DB.
    const { data: catRow, error: catErr } = await supabase
      .from("provider_catalog")
      .select("code, kind, name, enabled, setup_fields")
      .eq("code", data.provider)
      .maybeSingle();
    if (catErr) throw new Error(catErr.message);

    let providerName: string;
    let providerCode: string;
    let iKind: "store" | "payment_gateway" | "communication";
    let providerKind: ProviderKind;
    let requiredKeys: string[] = [];

    if (catRow) {
      if (!catRow.enabled) throw new Error(`Provider "${catRow.name}" is currently disabled.`);
      providerName = catRow.name;
      providerCode = catRow.code;
      providerKind = catRow.kind as ProviderKind;
      iKind = integrationKindFor(providerKind);
      const fields = Array.isArray(catRow.setup_fields) ? catRow.setup_fields : [];
      requiredKeys = fields
        .filter(
          (f): f is { key: string; required?: boolean; label?: string } =>
            typeof f === "object" && f !== null && "key" in f,
        )
        .filter((f) => f.required === true)
        .map((f) => f.key);
      // Also validate label-based required from in-code catalog for consistency.
      const legacy = getAdapterInfo(data.provider);
      if (legacy) {
        for (const f of legacy.fields) {
          if (f.required && !requiredKeys.includes(f.key)) requiredKeys.push(f.key);
        }
      }
    } else {
      const info = getAdapterInfo(data.provider);
      if (!info) throw new Error(`Unknown integration: ${data.provider}`);
      providerName = info.name;
      providerCode = info.provider;
      iKind = info.kind;
      providerKind =
        info.kind === "store" ? "store" : info.kind === "payment_gateway" ? "gateway" : "email"; // best guess for legacy comms — plan limit still applies
      requiredKeys = info.fields.filter((f) => f.required).map((f) => f.key);
    }

    // Authorization: caller must be a workspace member with manage rights.
    const { data: canManage, error: roleErr } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!canManage)
      throw new Error("You do not have permission to change integrations for this workspace.");

    // Validate required fields.
    for (const key of requiredKeys) {
      if (!data.credentials[key]?.toString().trim()) {
        throw new Error(`${key} is required.`);
      }
    }

    // Test against upstream provider.
    const { getAdapter } = await import("./integrations/registry.server");
    const adapter = getAdapter(providerCode);
    const result = await adapter.test(data.credentials);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    // Derive a stable account id from the public config to allow multiple
    // integrations of the same provider under one workspace.
    const cfg = (result.publicConfig ?? {}) as Record<string, unknown>;
    const accountId = String(
      cfg.account_id ??
        cfg.shop_domain ??
        cfg.store_id ??
        cfg.phone_number_id ??
        cfg.account_sid ??
        cfg.from_domain ??
        cfg.merchant_account ??
        cfg.site_url ??
        cfg.store_url ??
        cfg.base_url ??
        data.credentials.shop_domain ??
        data.credentials.site_url ??
        data.credentials.from_domain ??
        data.credentials.phone_number_id ??
        data.credentials.account_sid ??
        data.credentials.merchant_account ??
        "default",
    ).slice(0, 200);

    if (!result.ok) {
      // Enforce plan limit on new failed attempts too, so a Starter workspace
      // can't stack error rows past their allotment.
      const { count } = await supabase
        .from("integrations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("kind", iKind)
        .eq("provider", providerCode)
        .eq("provider_account_id", accountId);
      if ((count ?? 0) === 0) {
        try {
          await assertCanConnect(supabase, data.workspaceId, providerKind, userId);
        } catch (e) {
          if (e instanceof PlanLimitError) return { ok: false as const, message: e.message };
          throw e;
        }
      }

      await supabaseAdmin.from("integrations").upsert(
        {
          workspace_id: data.workspaceId,
          kind: iKind,
          provider: providerCode,
          provider_account_id: accountId,
          display_name: data.displayName ?? providerName,
          status: "error",
          health: "unhealthy",
          last_error: result.message,
          config: {},
          verification_status: "failed",
          last_test_at: nowIso,
          last_test_ok: false,
        },
        { onConflict: "workspace_id,kind,provider,provider_account_id" },
      );
      return { ok: false as const, message: result.message };
    }

    // For successful connections, enforce plan limit if this is a NEW row.
    const { data: existing } = await supabase
      .from("integrations")
      .select("id, webhook_secret, webhook_verify_token")
      .eq("workspace_id", data.workspaceId)
      .eq("kind", iKind)
      .eq("provider", providerCode)
      .eq("provider_account_id", accountId)
      .maybeSingle();

    if (!existing) {
      await assertCanConnect(supabase, data.workspaceId, providerKind, userId);
    }

    // Encrypt credentials + generate webhook secret & verify token if needed.
    const { encryptJSON } = await import("./crypto.server");
    const ciphertext = encryptJSON(data.credentials);
    const webhookSecret = existing?.webhook_secret ?? randomBytes(24).toString("base64url");
    const webhookVerifyToken =
      existing?.webhook_verify_token ??
      (data.credentials.verify_token?.toString().trim() || randomBytes(16).toString("hex"));

    const { error: upErr } = await supabaseAdmin.from("integrations").upsert(
      {
        workspace_id: data.workspaceId,
        kind: iKind,
        provider: providerCode,
        provider_account_id: accountId,
        display_name: data.displayName ?? providerName,
        status: "connected",
        health: "healthy",
        config: (result.publicConfig ?? {}) as never,
        credentials_ciphertext: ciphertext,
        webhook_secret: webhookSecret,
        webhook_verify_token: webhookVerifyToken,
        verification_status: "verified",
        last_verified_at: nowIso,
        last_test_at: nowIso,
        last_test_ok: true,
        last_error: null,
      },
      { onConflict: "workspace_id,kind,provider,provider_account_id" },
    );
    if (upErr) throw new Error(upErr.message);

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: data.workspaceId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string })?.email ?? null,
      action: "integration.connected",
      targetType: "integration",
      targetId: `${iKind}:${providerCode}:${accountId}`,
      details: { provider: providerCode, kind: iKind, account: accountId },
    });

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

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: row.workspace_id,
      actorId: userId,
      actorEmail: (context.claims as { email?: string })?.email ?? null,
      action: "integration.disconnected",
      targetType: "integration",
      targetId: row.id,
    });

    return { ok: true as const };
  });

/** Mark a workspace ready and turn on the recovery engine. */
export const activateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        retryGrant: z.string().min(10).max(2048).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to activate this workspace.");

    // If this call originates from a retry-confirmation dialog, the client
    // must present the signed grant returned by logActivationRetry. The
    // server refuses to run the activation phase unless "activate" is in
    // the exact set of step IDs the user confirmed.
    if (data.retryGrant) {
      const { verifyRetryGrant } = await import("./activation-grant.server");
      const result = verifyRetryGrant(data.retryGrant, data.workspaceId);
      if (!result.ok) throw new Error(result.reason);
      if (!result.allowedStepIds.includes("activate")) {
        throw new Error(
          "This retry was confirmed for a subset that does not include the activation step.",
        );
      }
    }

    // Full activation gate: ≥1 verified store + gateway + email, every
    // connected integration must have last_test_ok=true and verification_status='verified',
    // and no webhook failures in the last 24 hours.
    const { data: integrations, error } = await supabase
      .from("integrations")
      .select("id, kind, provider, status, verification_status, last_test_ok")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);

    const { data: catalog, error: catErr } = await supabase
      .from("provider_catalog")
      .select("code, kind");
    if (catErr) throw new Error(catErr.message);
    const kindByCode = new Map<string, string>(
      (catalog ?? []).map((c) => [c.code, c.kind as string]),
    );

    const connected = (integrations ?? []).filter((i) => i.status === "connected");
    const hasStore = connected.some((i) => kindByCode.get(i.provider) === "store");
    const hasGateway = connected.some((i) => kindByCode.get(i.provider) === "gateway");
    const hasEmail = connected.some((i) => kindByCode.get(i.provider) === "email");
    if (!hasStore) throw new Error("Connect a store before activating.");
    if (!hasGateway) throw new Error("Connect a payment gateway before activating.");
    if (!hasEmail) throw new Error("Connect an email delivery provider before activating.");

    const notVerified = connected.filter(
      (i) => i.verification_status !== "verified" || i.last_test_ok !== true,
    );
    if (notVerified.length > 0) {
      throw new Error(
        `Every connection must be verified with a passing test. ${notVerified.length} still need attention.`,
      );
    }

    const connectedIds = connected.map((i) => i.id);
    if (connectedIds.length > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: failures, error: whErr } = await supabase
        .from("webhook_logs")
        .select("id", { count: "exact", head: true })
        .in("integration_id", connectedIds)
        .gte("received_at", since)
        .or("signature_valid.eq.false,status_code.gte.400");
      if (whErr) throw new Error(whErr.message);
      if ((failures ?? 0) > 0) {
        throw new Error(
          `Resolve the ${failures} webhook failure(s) in the last 24h before activating.`,
        );
      }
    }

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

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: data.workspaceId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string })?.email ?? null,
      action: "workspace.activated",
      targetType: "workspace",
      targetId: data.workspaceId,
    });

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
    await supabaseAdmin
      .from("workspaces")
      .update({ setup_step: data.step })
      .eq("id", data.workspaceId);
    return { ok: true as const };
  });

/**
 * Record that a user triggered a retry of the activation flow. Writes to
 * `audit_logs` so admins can see who retried and which step IDs were
 * targeted. Non-blocking: the retry itself proceeds regardless of audit
 * outcome (writeAuditLog swallows failures).
 */
const ACTIVATION_STEP_ID = z.enum([
  "permission",
  "required",
  "verified",
  "webhooks",
  "activate",
]);

export const logActivationRetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        scope: z.enum(["all", "failed_only", "from_step"]),
        stepIds: z.array(ACTIVATION_STEP_ID).min(1).max(5),
        fromStep: ACTIVATION_STEP_ID.optional(),
        previousErrors: z.record(ACTIVATION_STEP_ID, z.string().max(500)).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canManage } = await supabase.rpc("can_manage_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canManage) throw new Error("You do not have permission to retry activation.");

    // Canonicalise the requested set and enforce scope consistency so the
    // retry grant issued below matches exactly what the user confirmed.
    const canonical = ["permission", "required", "verified", "webhooks", "activate"] as const;
    const unique = Array.from(new Set(data.stepIds));
    const sorted = unique
      .slice()
      .sort((a, b) => canonical.indexOf(a) - canonical.indexOf(b));

    if (data.scope === "all" && sorted.length !== canonical.length) {
      throw new Error("Retry scope 'all' must include every activation step.");
    }
    if (data.scope === "from_step") {
      if (!data.fromStep) throw new Error("fromStep is required for scope 'from_step'.");
      const startIdx = canonical.indexOf(data.fromStep);
      const expected = canonical.slice(startIdx);
      if (
        sorted.length !== expected.length ||
        sorted.some((s, i) => s !== expected[i])
      ) {
        throw new Error(
          "Retry step IDs do not match the confirmed fromStep sequence.",
        );
      }
    }
    if (data.scope === "failed_only") {
      const errored = Object.keys(data.previousErrors ?? {});
      if (errored.length === 0) {
        throw new Error("No failed steps recorded to retry.");
      }
      const erroredSet = new Set(errored);
      if (sorted.some((s) => !erroredSet.has(s))) {
        throw new Error("Retry set includes steps that were not marked failed.");
      }
    }

    const { issueRetryGrant } = await import("./activation-grant.server");
    const grant = issueRetryGrant({ workspaceId: data.workspaceId, allowedStepIds: sorted });

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: data.workspaceId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string })?.email ?? null,
      action:
        data.scope === "failed_only"
          ? "activation.retry_failed_steps"
          : data.scope === "from_step"
            ? "activation.retry_from_step"
            : "activation.retry",
      targetType: "workspace",
      targetId: data.workspaceId,
      details: {
        scope: data.scope,
        step_ids: sorted,
        from_step: data.fromStep ?? null,
        previous_errors: data.previousErrors ?? {},
        grant_expires_at: grant.expiresAt,
      },
    });

    return {
      ok: true as const,
      grant: grant.token,
      allowedStepIds: grant.allowedStepIds,
      expiresAt: grant.expiresAt,
    };
  });
