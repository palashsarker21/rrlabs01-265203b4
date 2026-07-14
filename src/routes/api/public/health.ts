import { createFileRoute } from "@tanstack/react-router";

/**
 * Public health endpoint. Non-sensitive, cache-disabled JSON so the
 * status page and external monitors can poll it.
 */

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        const checks = {
          server: { status: "ok" as const },
          database: await checkDatabase(),
        };

        const overall = Object.values(checks).every((c) => c.status === "ok")
          ? "ok"
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

async function checkDatabase(): Promise<{ status: "ok" | "degraded" | "down"; latency_ms?: number; error?: string }> {
  const started = Date.now();
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { status: "degraded", error: "not_configured" };
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
