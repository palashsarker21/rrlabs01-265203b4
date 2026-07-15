import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { BRAND, SITE_URL } from "@/lib/brand";
import { listPublicIncidents, type PublicIncident } from "@/lib/incidents.functions";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: `System Status — ${BRAND.name}` },
      {
        name: "description",
        content: `Real-time status of ${BRAND.name} recovery engine, API, and integrations.`,
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/status` }],
  }),
});

type CheckStatus = "ok" | "degraded" | "down" | "not_configured";
type HealthResponse = {
  status: CheckStatus;
  checked_at: string;
  checks: Record<string, { status: CheckStatus; latency_ms?: number }>;
};

const LABELS: Record<string, string> = {
  server: "API Server",
  database: "Database & Auth",
  lemonsqueezy: "Lemon Squeezy Billing",
  stripe: "Stripe",
  resend: "Resend Email",
  whatsapp: "WhatsApp Cloud API",
  gemini: "AI Gateway",
};

const TONE: Record<CheckStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Operational" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600", label: "Degraded" },
  down: { dot: "bg-red-500", text: "text-red-600", label: "Down" },
  not_configured: {
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    label: "Not configured",
  },
};

function StatusPage() {
  const { data, isLoading, isError } = useQuery<HealthResponse>({
    queryKey: ["public-health"],
    queryFn: async () => {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      return (await res.json()) as HealthResponse;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const overall = data?.status ?? (isError ? "down" : "ok");
  const overallTone = TONE[overall];
  const headline =
    overall === "ok"
      ? "All systems operational"
      : overall === "degraded"
        ? "Some services are degraded"
        : "System disruption detected";

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${overallTone.dot}`} />
          <h1 className="text-3xl font-semibold text-foreground">{headline}</h1>
        </div>
        {data?.checked_at && (
          <p className="mt-2 text-sm text-muted-foreground">
            Last checked {new Date(data.checked_at).toLocaleString()}
          </p>
        )}
        <div className="mt-10 divide-y divide-border/60 rounded-xl border border-border/60">
          {isLoading && !data
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <span className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))
            : Object.entries(data?.checks ?? {}).map(([key, c]) => {
                const tone = TONE[c.status];
                return (
                  <div key={key} className="flex items-center justify-between px-5 py-4">
                    <span className="flex items-center gap-3 text-foreground">
                      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                      {LABELS[key] ?? key}
                    </span>
                    <span className={`text-sm ${tone.text}`}>
                      {tone.label}
                      {typeof c.latency_ms === "number" && c.status === "ok" && (
                        <span className="ml-2 text-muted-foreground">{c.latency_ms}ms</span>
                      )}
                    </span>
                  </div>
                );
              })}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Provider health is checked server-side. No credentials are ever exposed to the client.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
