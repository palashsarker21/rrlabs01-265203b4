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
        content: `Real-time availability of ${BRAND.name} customer-facing services.`,
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

type PublicStatus = "operational" | "degraded" | "partial_outage" | "major_outage";
type PublicComponent = { id: string; name: string; status: PublicStatus };
type PublicHealth = {
  status: PublicStatus;
  checked_at: string;
  components: PublicComponent[];
};

const TONE: Record<PublicStatus, { dot: string; text: string; label: string }> = {
  operational: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Operational" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600", label: "Degraded" },
  partial_outage: { dot: "bg-orange-500", text: "text-orange-600", label: "Partial Outage" },
  major_outage: { dot: "bg-red-500", text: "text-red-600", label: "Major Outage" },
};

const IMPACT_TONE: Record<string, string> = {
  none: "bg-muted-foreground/40 text-muted-foreground",
  minor: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  major: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

// Baseline customer-facing services always shown, even before the first
// fetch resolves. Scheduled Maintenance is surfaced from the incidents feed.
const BASELINE: PublicComponent[] = [
  { id: "website", name: "Website", status: "operational" },
  { id: "api", name: "API", status: "operational" },
  { id: "authentication", name: "Authentication", status: "operational" },
  { id: "billing", name: "Billing", status: "operational" },
  { id: "email_delivery", name: "Email Delivery", status: "operational" },
];

function StatusPage() {
  const incidentsFn = useServerFn(listPublicIncidents);
  const { data, isLoading } = useQuery<PublicHealth>({
    queryKey: ["public-health"],
    queryFn: async () => {
      const res = await fetch("/api/public/health", { cache: "no-store" });
      return (await res.json()) as PublicHealth;
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
  const maintenance = activeIncidents.filter((i) => i.impact === "none");

  const components = data?.components ?? BASELINE;
  const overall: PublicStatus =
    activeIncidents.some((i) => i.impact === "critical")
      ? "major_outage"
      : activeIncidents.some((i) => i.impact === "major")
        ? "partial_outage"
        : activeIncidents.length > 0
          ? "degraded"
          : (data?.status ?? "operational");
  const overallTone = TONE[overall];
  const headline =
    overall === "operational"
      ? "All systems operational"
      : overall === "degraded"
        ? "Some services are degraded"
        : overall === "partial_outage"
          ? "Partial service outage"
          : "Major service outage";

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
              ? BASELINE.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-4">
                    <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <span className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))
              : components.map((c) => {
                  const tone = TONE[c.status];
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-4">
                      <span className="flex items-center gap-3 text-foreground">
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {c.name}
                      </span>
                      <span className={`text-sm ${tone.text}`}>{tone.label}</span>
                    </div>
                  );
                })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Scheduled maintenance</h2>
          {maintenance.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 px-5 py-4 text-sm text-muted-foreground">
              No maintenance scheduled.
            </p>
          ) : (
            <div className="space-y-4">
              {maintenance.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Incident history</h2>
          {pastIncidents.length === 0 ? (
            <p className="rounded-xl border border-border/60 bg-card/40 px-5 py-4 text-sm text-muted-foreground">
              No incidents in the recent history.
            </p>
          ) : (
            <div className="space-y-4">
              {pastIncidents.map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </div>
          )}
        </section>
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
      {incident.summary && <p className="mt-3 text-sm text-muted-foreground">{incident.summary}</p>}
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
