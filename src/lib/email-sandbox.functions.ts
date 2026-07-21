/**
 * Admin test-send sandbox.
 *
 * - Super-admin gated.
 * - Force-locks the recipient to the caller's own auth email (no arbitrary blasting).
 * - Enforces safe rate limits (per-minute / per-hour / per-day) using `email_logs`
 *   filtered by an `admin_sandbox` metadata marker.
 * - Returns rich diagnostics: config status, DNS status, render/send timings,
 *   attempts, provider message id, and log id.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SANDBOX_TAG = "admin_sandbox";

// Safety-first defaults for a self-serve test tool.
const LIMITS = {
  perMinute: 3,
  perHour: 15,
  perDay: 50,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callerEmail(context: { claims: any }): string | null {
  const c = context.claims ?? {};
  const raw = (c.email as string | undefined) ?? (c.user_metadata?.email as string | undefined);
  return raw ? String(raw).trim().toLowerCase() : null;
}

type Usage = { minute: number; hour: number; day: number };

async function readUsage(userId: string): Promise<Usage> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("email_logs")
    .select("created_at,metadata")
    .gte("created_at", dayAgo)
    .contains("metadata", { source: SANDBOX_TAG, actor: userId } as never)
    .limit(500);
  if (error) return { minute: 0, hour: 0, day: 0 };
  let minute = 0;
  let hour = 0;
  let day = 0;
  for (const row of data ?? []) {
    const t = new Date(row.created_at as string).getTime();
    if (Number.isNaN(t)) continue;
    const age = now - t;
    day += 1;
    if (age <= 60 * 60 * 1000) hour += 1;
    if (age <= 60 * 1000) minute += 1;
  }
  return { minute, hour, day };
}

function overLimit(u: Usage): { over: true; window: "minute" | "hour" | "day" } | { over: false } {
  if (u.minute >= LIMITS.perMinute) return { over: true, window: "minute" };
  if (u.hour >= LIMITS.perHour) return { over: true, window: "hour" };
  if (u.day >= LIMITS.perDay) return { over: true, window: "day" };
  return { over: false };
}

export const getSandboxStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const [{ loadEmailConfig }, { verifyEmailDns }] = await Promise.all([
      import("./email/config.server"),
      import("./email/dns.server"),
    ]);
    const cfg = loadEmailConfig();
    const domain = cfg.ok ? cfg.config.domain : "rrlabs.online";
    const dns = await verifyEmailDns(domain).catch(() => []);
    const usage = await readUsage(context.userId);
    return {
      recipient: callerEmail(context),
      config: cfg.ok
        ? {
            ok: true as const,
            domain,
            fromEmail: cfg.config.fromEmail,
            fromName: cfg.config.fromName,
          }
        : { ok: false as const, missing: cfg.missing, reason: cfg.reason },
      dns,
      usage,
      limits: LIMITS,
    };
  });

export const sendSandboxTestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { template: string; data?: Record<string, unknown> }) =>
    z
      .object({
        template: z.string().min(1).max(64),
        data: z.record(z.string(), z.unknown()).default({}).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);

    const to = callerEmail(context);
    if (!to) {
      return {
        ok: false as const,
        error: "no_recipient",
        message: "Your account has no verified email on file.",
      };
    }

    const { isTemplateName } = await import("./email/templates/registry");
    if (!isTemplateName(data.template)) {
      return { ok: false as const, error: "unknown_template" };
    }

    const usage = await readUsage(context.userId);
    const cap = overLimit(usage);
    if (cap.over) {
      return {
        ok: false as const,
        error: "rate_limited",
        window: cap.window,
        usage,
        limits: LIMITS,
      };
    }

    const startedAt = Date.now();
    const { sendEmail } = await import("./email/service.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendEmail<any>({
      template: data.template,
      to,
      data: (data.data ?? {}) as never,
      idempotencyKey: `admin-sandbox-${context.userId}-${data.template}-${Date.now()}`,
      tags: { source: SANDBOX_TAG },
      metadata: { source: SANDBOX_TAG, actor: context.userId },
    });
    const durationMs = Date.now() - startedAt;

    // Enrich with log row for diagnostics.
    let diagnostics: {
      logId?: string;
      status?: string;
      attempts?: number;
      messageId?: string | null;
      lastError?: string | null;
      subject?: string;
    } = {};
    if (result.ok && result.id && result.id !== "skipped") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("email_logs")
          .select("id,status,attempts,provider_message_id,last_error,subject")
          .eq("id", result.id)
          .maybeSingle();
        if (row) {
          diagnostics = {
            logId: row.id,
            status: row.status,
            attempts: row.attempts ?? undefined,
            messageId: row.provider_message_id ?? null,
            lastError: row.last_error ?? null,
            subject: row.subject ?? undefined,
          };
        }
      } catch {
        /* ignore */
      }
    }

    const nextUsage = await readUsage(context.userId);
    return {
      ok: true as const,
      recipient: to,
      durationMs,
      result,
      diagnostics,
      usage: nextUsage,
      limits: LIMITS,
    };
  });
