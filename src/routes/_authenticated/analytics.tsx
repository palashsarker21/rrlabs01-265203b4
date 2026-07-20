import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  Activity,
  Zap,
  DollarSign,
  MailCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartTooltipContent } from "@/components/ui/chart-tooltip";
import { SkeletonKpi, SkeletonChart } from "@/components/ui/skeleton-block";
import { BarChart3 } from "lucide-react";
import { getRecoveryAnalytics } from "@/lib/recovery-analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Recovery analytics — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-rose-500" role="alert">
      Failed to load analytics: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Analytics not found.</div>
  ),
});

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const CHANNEL_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 262 83% 58%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
];

function money(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState<number>(30);

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ["workspaces-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeWorkspace = workspaces?.[0];
  const analytics = useServerFn(getRecoveryAnalytics);

  const query = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-analytics", activeWorkspace?.id, days],
    queryFn: () => analytics({ data: { workspaceId: activeWorkspace!.id, days } }),
    refetchInterval: 60_000,
  });

  const data = query.data;

  const combinedSeries = useMemo(() => {
    if (!data) return [] as Array<{
      date: string;
      events: number;
      recovered: number;
      recoveredCents: number;
      sent: number;
      delivered: number;
      failed: number;
    }>;
    return data.timeSeries.map((e, i) => ({
      date: e.date,
      events: e.events,
      recovered: e.recovered,
      recoveredCents: e.recoveredCents,
      sent: data.attempts[i]?.sent ?? 0,
      delivered: data.attempts[i]?.delivered ?? 0,
      failed: data.attempts[i]?.failed ?? 0,
    }));
  }, [data]);

  if (wsLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!activeWorkspace) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">
          No workspace yet. Create one to see recovery analytics.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link to="/app">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/app" })}
              className="gap-1"
            >
              <ArrowLeft className="size-4" /> Dashboard
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Recovery analytics</h1>
              <p className="text-xs text-muted-foreground">
                {activeWorkspace.name} · last {days} days
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-md border bg-background p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={
                  "rounded px-3 py-1 text-xs font-medium transition-colors " +
                  (days === r.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* KPIs */}
        <section
          aria-label="Key metrics"
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
        >
          {query.isLoading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <StatCard
                icon={<DollarSign className="size-4" />}
                label="Revenue recovered"
                value={money(data?.recoveredCents ?? 0, data?.currency)}
                footnote={`${money(data?.atRiskCents ?? 0, data?.currency)} at risk`}
              />
              <StatCard
                icon={<TrendingUp className="size-4" />}
                label="Recovery rate"
                value={`${Math.round((data?.recoveryRate ?? 0) * 100)}%`}
                footnote={`${data?.totalRecovered ?? 0} of ${data?.totalEvents ?? 0} events`}
              />
              <StatCard
                icon={<Activity className="size-4" />}
                label="Events"
                value={String(data?.totalEvents ?? 0)}
                footnote={`${data?.totalInFlight ?? 0} in flight · ${data?.totalAbandoned ?? 0} abandoned`}
              />
              <StatCard
                icon={<MailCheck className="size-4" />}
                label="Messages delivered"
                value={String(data?.attemptsDelivered ?? 0)}
                footnote={`${data?.attemptsSent ?? 0} sent · ${data?.attemptsFailed ?? 0} failed`}
              />
            </>
          )}
        </section>

        {/* Revenue recovered over time */}
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Revenue recovered over time</h2>
              <p className="text-xs text-muted-foreground">
                Daily recovered amount ({(data?.currency ?? "USD").toUpperCase()})
              </p>
            </div>
            <Zap className="size-4 text-primary" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedSeries}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => money(v, data?.currency)}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                  labelFormatter={shortDate}
                  formatter={(v: number) => money(v, data?.currency)}
                />
                <Area
                  type="monotone"
                  dataKey="recoveredCents"
                  name="Recovered"
                  stroke="hsl(var(--primary))"
                  fill="url(#revGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Events vs recovered */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Events vs recovered</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={combinedSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    labelFormatter={shortDate}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="events" name="Events" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="recovered" name="Recovered" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Attempts over time */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Recovery attempts</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    labelFormatter={shortDate}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    name="Delivered"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="hsl(0 84% 60%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Channel breakdown */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Channel mix</h2>
            {data && data.channels.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.channels}
                      dataKey="sent"
                      nameKey="channel"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {data.channels.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </section>

          {/* Failure categories */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Top failure categories</h2>
            {data && data.failureCategories.length > 0 ? (
              <div className="space-y-2">
                {data.failureCategories.slice(0, 6).map((f) => {
                  const max = data.failureCategories[0]?.count || 1;
                  const pct = Math.round((f.count / max) * 100);
                  return (
                    <div key={f.category} className="space-y-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium">{f.category}</span>
                        <span className="text-muted-foreground">
                          {f.count} · {money(f.amountCents, data.currency)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart />
            )}
          </section>
        </div>

        <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
          <MiniStat
            label="Avg attempts per recovery"
            value={(data?.avgAttemptsPerRecovery ?? 0).toFixed(1)}
          />
          <MiniStat
            label="Delivery rate"
            value={
              data && data.attemptsSent > 0
                ? `${Math.round((data.attemptsDelivered / data.attemptsSent) * 100)}%`
                : "—"
            }
          />
          <MiniStat
            label="Abandoned"
            value={String(data?.totalAbandoned ?? 0)}
          />
        </section>
      </main>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border bg-card p-4 " +
        (accent ? "border-primary/40 bg-primary/5" : "")
      }
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {loading ? <span className="text-muted-foreground">…</span> : value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
      No data yet for this range.
    </div>
  );
}
