import { createFileRoute } from "@tanstack/react-router";

/**
 * Public health endpoint. Non-sensitive, cache-disabled JSON so the
 * status page and external monitors can poll it. Never exposes secrets —
 * providers are reported as "ok" (configured) / "not_configured" only.
 */

type CheckStatus = "ok" | "degraded" | "down" | "not_configured";
type Check = { status: CheckStatus; latency_ms?: number; error?: string };

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const [database] = await Promise.all([checkDatabase()]);
        const { checkRequiredServerEnv } = await import("@/lib/server-env.server");
        const envReport = checkRequiredServerEnv();
        const checks: Record<string, Check> = {
          server: {
            status: envReport.ok ? "ok" : "down",
            error: envReport.ok ? undefined : `missing:${envReport.missing.join(",")}`,
          },
          database,
          encryption_key: checkConfigured(process.env.RRLABS_ENCRYPTION_KEY),
          openrouter: checkConfigured(process.env.OPEN_ROUTER_API_KEY),
          lemonsqueezy: checkConfigured(process.env.LEMONSQUEEZY_API_KEY),
          stripe: checkConfigured(process.env.STRIPE_SECRET_KEY),
          resend: checkConfigured(process.env.RESEND_API_KEY),
          whatsapp: checkConfigured(process.env.WHATSAPP_ACCESS_TOKEN),
          gemini: checkConfigured(process.env.LOVABLE_API_KEY),
        };

        const critical: CheckStatus[] = [checks.server.status, checks.database.status];
        const overall: CheckStatus = critical.every((s) => s === "ok")
          ? "ok"
          : critical.some((s) => s === "down")
            ? "down"
            : "degraded";

        return new Response(
          JSON.stringify({
            status: overall,
            checked_at: new Date().toISOString(),
            latency_ms: Date.now() - started,
            checks,
          }),
          {
            status: overall === "ok" ? 200 : 503,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});

function checkConfigured(v: string | undefined): Check {
  return v && v.length > 0 ? { status: "ok" } : { status: "not_configured" };
}

async function checkDatabase(): Promise<Check> {
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
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
