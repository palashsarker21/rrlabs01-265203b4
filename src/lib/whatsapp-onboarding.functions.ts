/**
 * WhatsApp Cloud API onboarding server functions.
 *
 * Solves the Meta chicken-and-egg: before Meta can verify the callback URL,
 * we need a stable integrationId + webhook_verify_token stored in the
 * `integrations` table. This module provisions that row in `pending` state
 * (no upstream credentials required), then supports live verification,
 * connection tests, and status reads — all reusing the existing multi-tenant
 * webhook endpoint at `/api/public/webhooks/whatsapp_cloud/{integrationId}`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const workspaceInput = z.object({ workspaceId: z.string().uuid() });
const idInput = z.object({ integrationId: z.string().uuid() });
const idOriginInput = z.object({
  integrationId: z.string().uuid(),
  origin: z.string().url(),
});

async function assertManage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  userId: string,
) {
  const { data, error } = await supabase.rpc("can_manage_workspace", {
    _workspace_id: workspaceId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You do not have permission to manage this workspace.");
}

/**
 * Provision (or reuse) a WhatsApp integration row for this workspace.
 * Generates `webhook_verify_token` and `webhook_secret` on first call, and
 * returns them so the wizard can display copy-ready values. Idempotent —
 * calling again returns the same secrets and existing integrationId.
 */
export const provisionWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => workspaceInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManage(supabase, data.workspaceId, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("integrations")
      .select(
        "id, status, webhook_secret, webhook_verify_token, config, verification_status, last_test_ok, last_error, display_name",
      )
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "whatsapp_cloud")
      .eq("provider_account_id", "default")
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (existing) {
      // Backfill missing tokens without disturbing existing state.
      const patch: Record<string, string> = {};
      if (!existing.webhook_verify_token) patch.webhook_verify_token = randomBytes(16).toString("hex");
      if (!existing.webhook_secret) patch.webhook_secret = randomBytes(24).toString("base64url");
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("integrations").update(patch).eq("id", existing.id);
      }
      return {
        integrationId: existing.id,
        webhookVerifyToken: patch.webhook_verify_token ?? existing.webhook_verify_token!,
        webhookSecret: patch.webhook_secret ?? existing.webhook_secret!,
        status: existing.status,
        verificationStatus: existing.verification_status,
        lastError: existing.last_error,
      };
    }

    const verifyToken = randomBytes(16).toString("hex");
    const webhookSecret = randomBytes(24).toString("base64url");

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("integrations")
      .insert({
        workspace_id: data.workspaceId,
        kind: "communication",
        provider: "whatsapp_cloud",
        provider_account_id: "default",
        display_name: "WhatsApp (Meta Cloud API)",
        status: "pending",
        health: null,
        config: {},
        webhook_verify_token: verifyToken,
        webhook_secret: webhookSecret,
        verification_status: "pending",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return {
      integrationId: inserted.id,
      webhookVerifyToken: verifyToken,
      webhookSecret: webhookSecret,
      status: "pending" as const,
      verificationStatus: "pending" as const,
      lastError: null as string | null,
    };
  });

/**
 * Read the current onboarding state (safe values only — never returns
 * encrypted credentials).
 */
export const getWhatsAppOnboardingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => idInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("integrations")
      .select(
        "id, workspace_id, status, config, verification_status, last_verified_at, last_test_at, last_test_ok, last_error, webhook_verify_token, webhook_secret, credentials_ciphertext",
      )
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");
    await assertManage(supabase, row.workspace_id, userId);

    return {
      integrationId: row.id,
      workspaceId: row.workspace_id,
      status: row.status,
      verificationStatus: row.verification_status,
      lastVerifiedAt: row.last_verified_at,
      lastTestAt: row.last_test_at,
      lastTestOk: row.last_test_ok,
      lastError: row.last_error,
      webhookVerifyToken: row.webhook_verify_token ?? "",
      webhookSecret: row.webhook_secret ?? "",
      hasCredentials: Boolean(row.credentials_ciphertext),
      config: (row.config ?? {}) as Record<string, unknown>,
    };
  });

/**
 * Perform a live GET verification against the existing public webhook
 * endpoint. Simulates the Meta subscribe handshake to confirm end-to-end
 * routing: DNS → edge → server route → DB lookup → token compare → echo.
 */
export const verifyWhatsAppWebhookLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => idOriginInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("integrations")
      .select("id, workspace_id, provider, webhook_verify_token")
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");
    await assertManage(supabase, row.workspace_id, userId);
    if (!row.webhook_verify_token) {
      return { ok: false, message: "No verify token has been provisioned yet." };
    }

    const challenge = randomBytes(8).toString("hex");
    const url =
      `${data.origin.replace(/\/+$/, "")}/api/public/webhooks/whatsapp_cloud/${row.id}` +
      `?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(row.webhook_verify_token)}` +
      `&hub.challenge=${challenge}`;

    let status = 0;
    let body = "";
    try {
      const res = await fetch(url, { method: "GET" });
      status = res.status;
      body = (await res.text()).trim();
    } catch (e) {
      return {
        ok: false,
        message: `Could not reach webhook endpoint: ${(e as Error).message}`,
        status: 0,
        url,
      };
    }

    if (status === 200 && body === challenge) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("integrations")
        .update({
          verification_status: "verified",
          last_verified_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      return { ok: true, message: "Webhook verified — Meta will accept this callback URL.", status, url };
    }

    return {
      ok: false,
      message:
        status === 200
          ? `Endpoint responded but did not echo the challenge (got "${body.slice(0, 80)}").`
          : `Endpoint returned HTTP ${status}. ${body.slice(0, 200)}`,
      status,
      url,
    };
  });

/**
 * Run a suite of connection-health checks against this integration. Verifies:
 *   - webhook endpoint reachable + verify handshake
 *   - DB row present + tokens provisioned
 *   - encryption round-trip
 *   - credential storage (if credentials have been saved)
 *   - Meta Graph API connectivity (if access_token stored)
 */
export const runWhatsAppConnectionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => idOriginInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("integrations")
      .select(
        "id, workspace_id, provider, webhook_verify_token, webhook_secret, credentials_ciphertext, config",
      )
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integration not found.");
    await assertManage(supabase, row.workspace_id, userId);

    const checks: { name: string; ok: boolean; detail: string }[] = [];

    // 1. DB row
    checks.push({ name: "Database record", ok: true, detail: `integration ${row.id} present` });

    // 2. Tokens provisioned
    checks.push({
      name: "Credential storage",
      ok: Boolean(row.webhook_verify_token && row.webhook_secret),
      detail:
        row.webhook_verify_token && row.webhook_secret
          ? "verify token + webhook secret provisioned"
          : "tokens missing — reprovision the integration",
    });

    // 3. Encryption round-trip
    try {
      const { encryptJSON, decryptJSON } = await import("./crypto.server");
      const probe = { ping: randomBytes(4).toString("hex") };
      const ct = encryptJSON(probe);
      const rt = decryptJSON<typeof probe>(ct);
      checks.push({
        name: "Encryption",
        ok: rt.ping === probe.ping,
        detail: rt.ping === probe.ping ? "AES-GCM round-trip OK" : "round-trip mismatch",
      });
    } catch (e) {
      checks.push({ name: "Encryption", ok: false, detail: (e as Error).message });
    }

    // 4. Webhook endpoint (live verify)
    if (row.webhook_verify_token) {
      const challenge = randomBytes(8).toString("hex");
      const url =
        `${data.origin.replace(/\/+$/, "")}/api/public/webhooks/whatsapp_cloud/${row.id}` +
        `?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(row.webhook_verify_token)}` +
        `&hub.challenge=${challenge}`;
      try {
        const res = await fetch(url, { method: "GET" });
        const body = (await res.text()).trim();
        checks.push({
          name: "Webhook endpoint",
          ok: res.status === 200 && body === challenge,
          detail:
            res.status === 200 && body === challenge
              ? "verify handshake echoed challenge"
              : `HTTP ${res.status} ${body.slice(0, 80)}`,
        });
      } catch (e) {
        checks.push({ name: "Webhook endpoint", ok: false, detail: (e as Error).message });
      }
    } else {
      checks.push({ name: "Webhook endpoint", ok: false, detail: "no verify token" });
    }

    // 5. Meta Graph API — only if credentials stored
    if (row.credentials_ciphertext) {
      try {
        const { decryptJSON } = await import("./crypto.server");
        const creds = decryptJSON<Record<string, string>>(row.credentials_ciphertext);
        const token = creds.access_token?.trim();
        const phoneId = creds.phone_number_id?.trim();
        if (!token || !phoneId) {
          checks.push({
            name: "Meta Graph API",
            ok: false,
            detail: "credentials incomplete (access_token / phone_number_id missing)",
          });
        } else {
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const j = (await res.json()) as { display_phone_number?: string; verified_name?: string };
            checks.push({
              name: "Meta Graph API",
              ok: true,
              detail: `reached ${j.verified_name ?? j.display_phone_number ?? "phone number"}`,
            });
          } else {
            const b = await res.text().catch(() => "");
            checks.push({
              name: "Meta Graph API",
              ok: false,
              detail: `Meta returned HTTP ${res.status}. ${b.slice(0, 160)}`,
            });
          }
        }
      } catch (e) {
        checks.push({ name: "Meta Graph API", ok: false, detail: (e as Error).message });
      }
    } else {
      checks.push({
        name: "Meta Graph API",
        ok: false,
        detail: "no upstream credentials saved yet — complete step 5 in Meta Dashboard first",
      });
    }

    const allOk = checks.every((c) => c.ok);
    return { ok: allOk, checks };
  });
