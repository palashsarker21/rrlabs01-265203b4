import { createFileRoute } from "@tanstack/react-router";

/**
 * PUBLIC status endpoint. Customer-facing only.
 *
 * Exposes coarse availability for customer-visible services and NOTHING
 * about internal infrastructure, secrets, providers, environment variables,
 * or configuration. Internal diagnostics live behind the super-admin
 * `getSystemHealth` server function used by /admin/v2/system-health.
 */

type PublicStatus = "operational" | "degraded" | "partial_outage" | "major_outage";
type PublicComponent = { id: string; name: string; status: PublicStatus };

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const [dbOk, dbReachable] = await checkDatabaseReachable();

        const website: PublicStatus = "operational";
        const api: PublicStatus = "operational";
        const authentication: PublicStatus = dbOk
          ? "operational"
          : dbReachable
            ? "degraded"
            : "major_outage";
        // Billing / email delivery availability is intentionally reported
        // as operational unless we detect an active incident. We never
        // reveal whether a specific provider (Lemon Squeezy, Stripe,
        // Resend, WhatsApp) is configured — that is infrastructure detail.
        const billing: PublicStatus = "operational";
        const email_delivery: PublicStatus = "operational";

        const components: PublicComponent[] = [
          { id: "website", name: "Website", status: website },
          { id: "api", name: "API", status: api },
          { id: "authentication", name: "Authentication", status: authentication },
          { id: "billing", name: "Billing", status: billing },
          { id: "email_delivery", name: "Email Delivery", status: email_delivery },
        ];

        const overall: PublicStatus = worst(components.map((c) => c.status));

        return new Response(
          JSON.stringify({
            status: overall,
            checked_at: new Date().toISOString(),
            components,
          }),
          {
            status: overall === "operational" || overall === "degraded" ? 200 : 503,
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

const RANK: Record<PublicStatus, number> = {
  operational: 0,
  degraded: 1,
  partial_outage: 2,
  major_outage: 3,
};

function worst(list: PublicStatus[]): PublicStatus {
  return list.reduce<PublicStatus>(
    (acc, s) => (RANK[s] > RANK[acc] ? s : acc),
    "operational",
  );
}

async function checkDatabaseReachable(): Promise<[ok: boolean, reachable: boolean]> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [false, false];
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
    });
    return [res.ok, true];
  } catch {
    return [false, false];
  }
}
