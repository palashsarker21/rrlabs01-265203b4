import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";

import { getSystemHealth, type InternalCheck, type InternalCheckStatus, type SystemHealthReport } from "@/lib/system-health.functions";

export const Route = createFileRoute("/_authenticated/admin/v2/system-health")({
  component: SystemHealthPage,
  head: () => ({
    meta: [
      { title: "System Health — Platform Control Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TONE: Record<InternalCheckStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Operational" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600", label: "Degraded" },
  down: { dot: "bg-red-500", text: "text-red-600", label: "Down" },
  not_configured: {
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    label: "Not configured",
  },
};

function SystemHealthPage() {
  const load = useServerFn(getSystemHealth);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<SystemHealthReport>({
    queryKey: ["admin-system-health"],
    queryFn: () => load({}),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  if (isError) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="text-2xl font-semibold text-foreground">System Health</h1>
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {(error as Error)?.message ?? "Failed to load diagnostics."}
        </p>
      </div>
    );
  }

  const overallTone = TONE[data?.overall ?? "not_configured"];

  return (
    <div className="p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Activity className="h-5 w-5" aria-hidden />
            System Health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal diagnostics for platform infrastructure. Super Admin only —
            never exposed to customers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${overallTone.dot}`} />
            Overall: <span className={overallTone.text}>{overallTone.label}</span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading diagnostics…</div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Section
            title="Runtime"
            description="Core server and database health."
            rows={[
              { label: "API server", check: data.runtime.server },
              { label: "Database & auth", check: data.runtime.database },
              { label: "Encryption key (RRLABS_ENCRYPTION_KEY)", check: data.runtime.encryption_key },
            ]}
          />
          <Section
            title="AI Gateway"
            description="LLM providers used by the recovery engine."
            rows={[
              { label: "OpenRouter (OPEN_ROUTER_API_KEY)", check: data.ai.openrouter },
              { label: "Lovable AI Gateway (LOVABLE_API_KEY)", check: data.ai.lovable_gateway },
            ]}
          />
          <Section
            title="Messaging"
            description="Outbound email and WhatsApp providers."
            rows={[
              { label: "Resend (RESEND_API_KEY)", check: data.messaging.resend },
              { label: "WhatsApp Cloud (WHATSAPP_ACCESS_TOKEN)", check: data.messaging.whatsapp },
            ]}
          />
          <Section
            title="Billing"
            description="Merchant of Record and PSP credentials."
            rows={[
              { label: "Lemon Squeezy (LEMONSQUEEZY_API_KEY)", check: data.billing.lemonsqueezy },
              { label: "Stripe (STRIPE_SECRET_KEY)", check: data.billing.stripe },
            ]}
          />
          <div className="rounded-xl border border-border/60 bg-card/40 p-5 lg:col-span-2">
            <h2 className="text-base font-semibold text-foreground">Environment validation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Required server-only environment variables. Values are never logged
              or returned — only presence.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Present</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.env.present_required.length === 0 ? (
                    <li className="text-muted-foreground">None</li>
                  ) : (
                    data.env.present_required.map((k) => (
                      <li key={k} className="flex items-center gap-2 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <code className="font-mono text-xs">{k}</code>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Missing</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.env.missing_required.length === 0 ? (
                    <li className="text-muted-foreground">None</li>
                  ) : (
                    data.env.missing_required.map((k) => (
                      <li key={k} className="flex items-center gap-2 text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <code className="font-mono text-xs">{k}</code>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground lg:col-span-2">
            Last checked {new Date(data.checked_at).toLocaleString()} · probe {data.latency_ms}ms
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  rows,
}: {
  title: string;
  description?: string;
  rows: { label: string; check: InternalCheck }[];
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 divide-y divide-border/60">
        {rows.map(({ label, check }) => {
          const tone = TONE[check.status];
          return (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                {label}
              </span>
              <span className={`text-xs ${tone.text}`}>
                {tone.label}
                {typeof check.latency_ms === "number" && check.status === "ok" && (
                  <span className="ml-2 text-muted-foreground">{check.latency_ms}ms</span>
                )}
                {check.error && (
                  <span className="ml-2 text-muted-foreground">({check.error})</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
