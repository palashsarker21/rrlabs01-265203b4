/**
 * Admin-facing email server functions:
 *   - getEmailConfigStatus: config + DNS status for setup page
 *   - sendTestEmail: fire a test send from Admin > Email
 *   - listEmailLogs: paginated delivery history
 *   - listTemplateNames: registry for template picker
 *
 * All privileged fns are gated by super_admin via context.supabase.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getEmailConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { loadEmailConfig } = await import("./email/config.server");
    const { verifyEmailDns } = await import("./email/dns.server");

    const cfg = loadEmailConfig();
    if (!cfg.ok) {
      return {
        configured: false as const,
        reason: cfg.reason,
        missing: cfg.missing,
        from: null,
        domain: null,
        dns: [] as Awaited<ReturnType<typeof verifyEmailDns>>,
      };
    }
    const dns = await verifyEmailDns(cfg.config.domain).catch(() => []);
    return {
      configured: true as const,
      from: `${cfg.config.fromName} <${cfg.config.fromEmail}>`,
      domain: cfg.config.domain,
      webhook_configured: Boolean(cfg.config.webhookSecret),
      dns,
    };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; template?: string }) =>
    z
      .object({
        to: z.string().trim().email().max(255),
        template: z.string().min(1).max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { sendEmail } = await import("./email/service.server");
    const template = (data.template ?? "welcome") as "welcome" | "system-alert";
    if (template === "system-alert") {
      const result = await sendEmail({
        template: "system-alert",
        to: data.to,
        data: {
          title: "Test alert",
          message: "This is a test system alert sent from Admin > Email.",
          severity: "info" as const,
        },
        idempotencyKey: `test-alert-${context.userId}-${Date.now()}`,
        metadata: { source: "admin_test", actor: context.userId },
      });
      return result;
    }
    return sendEmail({
      template: "welcome",
      to: data.to,
      data: { name: "there", ctaUrl: "https://rrlabs.online/app" },
      idempotencyKey: `test-welcome-${context.userId}-${Date.now()}`,
      metadata: { source: "admin_test", actor: context.userId },
    });
  });

export const listEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; status?: string; search?: string }) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        status: z.string().max(32).optional(),
        search: z.string().max(255).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("email_logs")
      .select(
        "id,workspace_id,template,recipient,subject,status,provider_message_id,attempts,last_error,created_at,sent_at,delivered_at,failed_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.ilike("recipient", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { listTemplates } = await import("./email/templates/registry");
    return { templates: listTemplates() };
  });
