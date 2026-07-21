import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CreditCard,
  DollarSign,
  Mail,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Webhook,
  Zap,
} from "lucide-react";

import { getAdminOverview } from "@/lib/admin.functions";
import { getBillingMetrics } from "@/lib/billing-summary.functions";
import { getPlatformBadges } from "@/lib/platform/badges.functions";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformDashboard,
});

function money(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n / 100);
}

function PlatformDashboard() {
  const overview = useServerFn(getAdminOverview);
  const metrics = useServerFn(getBillingMetrics);
  const badgesFn = useServerFn(getPlatformBadges);

  const { data: workspaces } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overview({}),
  });
  const { data: billing } = useQuery({
    queryKey: ["admin-billing-metrics"],
    queryFn: () => metrics({}),
    refetchInterval: 60_000,
  });
  const { data: badges } = useQuery({
    queryKey: ["platform-badges"],
    queryFn: () => badgesFn({}),
    refetchInterval: 30_000,
  });

  const list = workspaces ?? [];
  const totals = {
    workspaces: list.length,
    active: list.filter((w) => w.status === "active").length,
    trial: list.filter((w) => w.status === "trial").length,
    events: list.reduce((s, w) => s + Number(w.events_count ?? 0), 0),
    recovered: list.reduce((s, w) => s + Number(w.recovered_amount_cents ?? 0), 0),
    recoveredCount: list.reduce((s, w) => s + Number(w.recovered_count ?? 0), 0),
  };
  const recoveryRate = totals.events > 0 ? (totals.recoveredCount / totals.events) * 100 : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live metrics across every organization on the platform.
        </p>
      </header>

      <section aria-label="Revenue" className="space-y-3">
        <SectionTitle>Revenue</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={<DollarSign className="h-4 w-4" />}
            label="MRR"
            value={money(Number(billing?.mrrCents ?? 0))}
            to="/admin"
            search={{ tab: "subscriptions" }}
          />
          <Kpi
            icon={<DollarSign className="h-4 w-4" />}
            label="ARR"
            value={money(Number(billing?.mrrCents ?? 0) * 12)}
            to="/admin"
            search={{ tab: "subscriptions" }}
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="Recovered (all time)"
            value={money(totals.recovered)}
            accent
            to="/admin"
            search={{ tab: "recovery" }}
          />
          <Kpi
            icon={<RefreshCw className="h-4 w-4" />}
            label="Recovery Rate"
            value={recoveryRate == null ? "No data yet" : `${recoveryRate.toFixed(1)}%`}
            to="/admin"
            search={{ tab: "analytics" }}
          />
        </div>
      </section>

      <section aria-label="Customers" className="space-y-3">
        <SectionTitle>Customers</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={<Building2 className="h-4 w-4" />}
            label="Active Organizations"
            value={totals.active}
            to="/admin/v2/customers"
          />
          <Kpi
            icon={<UserPlus className="h-4 w-4" />}
            label="Active Trials"
            value={totals.trial}
            to="/admin/v2/customers"
          />
          <Kpi
            icon={<CreditCard className="h-4 w-4" />}
            label="Active Subscriptions"
            value={Number(billing?.activeCount ?? 0)}
            to="/admin"
            search={{ tab: "subscriptions" }}
          />
          <Kpi
            icon={<Activity className="h-4 w-4" />}
            label="Total Workspaces"
            value={totals.workspaces}
            to="/admin/v2/customers"
          />
        </div>
      </section>

      <section aria-label="Operations" className="space-y-3">
        <SectionTitle>Operations</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={<Zap className="h-4 w-4" />}
            label="Recovery Events"
            value={totals.events}
            to="/admin"
            search={{ tab: "recovery" }}
          />
          <Kpi
            icon={<Webhook className="h-4 w-4" />}
            label="Webhook Failures"
            value={badges?.webhookFailures ?? 0}
            tone={badges && badges.webhookFailures > 0 ? "warn" : undefined}
            to="/admin"
            search={{ tab: "webhooks" }}
          />
          <Kpi
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Open Incidents"
            value={badges?.openIncidents ?? 0}
            tone={badges && badges.openIncidents > 0 ? "warn" : undefined}
            to="/admin"
            search={{ tab: "incidents" }}
          />
          <Kpi
            icon={<RefreshCw className="h-4 w-4" />}
            label="Failed Jobs"
            value={badges?.failedJobs ?? 0}
            tone={badges && badges.failedJobs > 0 ? "warn" : undefined}
            to="/admin"
            search={{ tab: "queue" }}
          />
        </div>
      </section>

      <section aria-label="Messaging" className="space-y-3">
        <SectionTitle>Messaging & AI</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={<Mail className="h-4 w-4" />}
            label="Pending Emails"
            value={badges?.pendingEmails ?? 0}
            to="/admin/email/deliveries"
          />
          <Kpi
            icon={<MessageSquare className="h-4 w-4" />}
            label="Pending WhatsApp"
            value={badges?.pendingWhatsapp ?? 0}
            to="/admin"
            search={{ tab: "whatsapp" }}
          />
          <Kpi
            icon={<Bot className="h-4 w-4" />}
            label="AI Analytics"
            value="View"
            to="/admin/v2/ai/analytics"
          />
          <Kpi
            icon={<Activity className="h-4 w-4" />}
            label="Platform Health"
            value="View"
            to="/admin/v2/system-health"
          />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
  tone,
  to,
  search,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
  tone?: "warn";
  to?: string;
  search?: Record<string, string>;
}) {
  const inner = (
    <div
      className={
        "group flex h-full flex-col justify-between rounded-xl border border-border/60 bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card/70"
      }
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span
          className={
            "text-2xl font-semibold " +
            (accent
              ? "text-primary"
              : tone === "warn"
                ? "text-amber-500"
                : "text-foreground")
          }
        >
          {value}
        </span>
        {to && (
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" />
        )}
      </div>
    </div>
  );
  if (!to) return inner;
  return (
    <Link to={to as never} search={(search ?? {}) as never} className="block">
      {inner}
    </Link>
  );
}
