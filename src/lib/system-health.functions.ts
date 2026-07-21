import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Full internal diagnostics for the Platform Control Center.
 * Super-admin gated — never exposed publicly. Never returns secret values,
 * only their configured/missing status plus latency and error class.
 */

export type InternalCheckStatus = "ok" | "degraded" | "down" | "not_configured";
export type InternalCheck = {
  status: InternalCheckStatus;
  latency_ms?: number;
  error?: string;
};

export type SystemHealthReport = {
  checked_at: string;
  latency_ms: number;
  overall: InternalCheckStatus;
  runtime: {
    server: InternalCheck;
    database: InternalCheck;
    encryption_key: InternalCheck;
  };
  ai: {
    openrouter: InternalCheck;
  };
  messaging: {
    resend: InternalCheck;
    whatsapp: InternalCheck;
  };
  billing: {
    lemonsqueezy: InternalCheck;
    stripe: InternalCheck;
  };
  env: {
    ok: boolean;
    missing_required: string[];
    present_required: string[];
  };
};

function checkConfigured(v: string | undefined): InternalCheck {
  return v && v.length > 0 ? { status: "ok" } : { status: "not_configured" };
}

async function checkDatabase(): Promise<InternalCheck> {
  const started = Date.now();
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { status: "not_configured" };
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
    });
    return {
      status: res.ok ? "ok" : "degraded",
      latency_ms: Date.now() - started,
    };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - started,
      error: err instanceof Error ? err.name : "unknown",
    };
  }
}

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealthReport> => {
    const { supabase, userId } = context;
    const { data: isSuper, error: rpcErr } = await supabase.rpc("is_super_admin", {
      _user_id: userId,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!isSuper) throw new Error("Forbidden");

    const started = Date.now();
    const { checkRequiredServerEnv } = await import("@/lib/server-env.server");
    const envReport = checkRequiredServerEnv();
    const database = await checkDatabase();

    const runtime = {
      server: {
        status: envReport.ok ? ("ok" as const) : ("down" as const),
        error: envReport.ok ? undefined : `missing:${envReport.missing.join(",")}`,
      },
      database,
      encryption_key: checkConfigured(process.env.RRLABS_ENCRYPTION_KEY),
    };
    const ai = {
      openrouter: checkConfigured(process.env.OPEN_ROUTER_API_KEY),
    };
    const messaging = {
      resend: checkConfigured(process.env.RESEND_API_KEY),
      whatsapp: checkConfigured(process.env.WHATSAPP_ACCESS_TOKEN),
    };
    const billing = {
      lemonsqueezy: checkConfigured(process.env.LEMONSQUEEZY_API_KEY),
      stripe: checkConfigured(process.env.STRIPE_SECRET_KEY),
    };

    const critical: InternalCheckStatus[] = [
      runtime.server.status,
      runtime.database.status,
      runtime.encryption_key.status === "not_configured" ? "down" : runtime.encryption_key.status,
    ];
    const overall: InternalCheckStatus = critical.every((s) => s === "ok")
      ? "ok"
      : critical.some((s) => s === "down")
        ? "down"
        : "degraded";

    return {
      checked_at: new Date().toISOString(),
      latency_ms: Date.now() - started,
      overall,
      runtime,
      ai,
      messaging,
      billing,
      env: {
        ok: envReport.ok,
        missing_required: envReport.missing,
        present_required: envReport.present,
      },
    };
  });
