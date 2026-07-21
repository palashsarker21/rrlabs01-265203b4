import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Command } from "lucide-react";

import { getAdminOverview } from "@/lib/admin.functions";
import { getBillingMetrics } from "@/lib/billing-summary.functions";
import { ADMIN_NAV } from "@/lib/admin/nav";

export const Route = createFileRoute("/_authenticated/admin/v2/")({
  component: AdminV2Overview,
});

function money(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n / 100);
}

function AdminV2Overview() {
  const overview = useServerFn(getAdminOverview);
  const metrics = useServerFn(getBillingMetrics);

  const { data: workspaces } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overview({}),
  });
  const { data: billing } = useQuery({
    queryKey: ["admin-billing-metrics"],
    queryFn: () => metrics({}),
    refetchInterval: 60_000,
  });

  const list = workspaces ?? [];
  const totals = {
    count: list.length,
    active: list.filter((w) => w.status === "active").length,
    events: list.reduce((s, w) => s + Number(w.events_count ?? 0), 0),
    recovered: list.reduce((s, w) => s + Number(w.recovered_amount_cents ?? 0), 0),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Executive metrics across every workspace on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Command className="h-3.5 w-3.5" aria-hidden />
          <span>
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">⌘K</kbd>{" "}
            to jump anywhere
          </span>
        </div>
      </header>

      <section aria-label="Platform KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Workspaces" value={totals.count} />
        <Kpi label="Active" value={totals.active} />
        <Kpi label="Recovery events" value={totals.events} />
        <Kpi label="Recovered value" value={money(totals.recovered)} accent />
        <Kpi
          label="MRR"
          value={money(Number(billing?.mrrCents ?? 0))}
          hint="Current recurring revenue"
        />
        <Kpi label="Active subs" value={Number(billing?.activeCount ?? 0)} />
        <Kpi label="Recovered (all time)" value={money(Number(billing?.recoveredCents ?? 0))} />
        <Kpi label="Failed webhooks (24h)" value={Number(billing?.webhooks?.failed24h ?? 0)} />
      </section>

      <section aria-label="Sections" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sections
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ADMIN_NAV.filter((n) => n.kind === "group").map((group) => {
            if (group.kind !== "group") return null;
            const Icon = group.icon;
            return (
              <div key={group.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                </div>
                <ul className="mt-3 space-y-1">
                  {group.items.slice(0, 5).map((leaf) => (
                    <li key={leaf.id}>
                      <Link
                        to={leaf.to as never}
                        search={(leaf.search ?? {}) as never}
                        className="group flex items-center justify-between rounded-md px-2 py-1 text-sm text-foreground/80 hover:bg-muted"
                      >
                        <span>{leaf.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
