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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Status", item: `${SITE_URL}/status` },
          ],
        }),
      },
    ],
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

const IMPACT_TONE: Record<string, string> = {
  none: "bg-muted-foreground/40 text-muted-foreground",
  minor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  major: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

function StatusPage() {
  const incidentsFn = useServerFn(listPublicIncidents);
  const { data, isLoading, isError } = useQuery<HealthResponse>({
    queryKey: ["public-health"],
    queryFn: async () => {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      return (await res.json()) as HealthResponse;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: incidents = [] } = useQuery<PublicIncident[]>({
    queryKey: ["public-incidents"],
    queryFn: () => incidentsFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const pastIncidents = incidents.filter((i) => i.status === "resolved").slice(0, 10);

  const overall =
    activeIncidents.some((i) => i.impact === "critical" || i.impact === "major")
      ? "down"
      : activeIncidents.length > 0
        ? "degraded"
        : (data?.status ?? (isError ? "down" : "ok"));
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

        {activeIncidents.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Active incidents</h2>
            <div className="space-y-4">
              {activeIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Services</h2>
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
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
        </section>

        {pastIncidents.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Recent incidents</h2>
            <div className="space-y-4">
              {pastIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          Provider health is checked server-side. No credentials are ever exposed to the client.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}

function IncidentCard({ incident }: { incident: PublicIncident }) {
  const impactClass = IMPACT_TONE[incident.impact] ?? IMPACT_TONE.minor;
  return (
    <article className="rounded-xl border border-border/60 bg-card/40 p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{incident.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Started {new Date(incident.started_at).toLocaleString()}
            {incident.resolved_at && (
              <> · Resolved {new Date(incident.resolved_at).toLocaleString()}</>
            )}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${impactClass}`}>
          {incident.impact} · {incident.status}
        </span>
      </header>
      {incident.summary && (
        <p className="mt-3 text-sm text-muted-foreground">{incident.summary}</p>
      )}
      {incident.affected_components.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Affected: {incident.affected_components.join(", ")}
        </p>
      )}
      {incident.updates.length > 0 && (
        <ol className="mt-4 space-y-3 border-l border-border/60 pl-4">
          {incident.updates.map((u) => (
            <li key={u.id}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono uppercase">{u.status}</span>
                <span>·</span>
                <time>{new Date(u.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{u.message}</p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
