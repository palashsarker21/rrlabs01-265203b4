import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  CreditCard,
  Handshake,
  Mail,
  MessageSquare,
  Plug,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TrialBadge,
  TrialReminderBanner,
  WorkspaceStatusBadge,
} from "@/components/trial-badge";
import { computeTrialInfo } from "@/lib/trial";
import { getRecoveryStats, listRecoveryEvents } from "@/lib/recovery.functions";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Dashboard — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

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

function Dashboard() {
  const navigate = useNavigate();

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select(
          "id, name, slug, status, recovery_engine_enabled, setup_step, trial_ends_at, trial_started_at, subscription_status",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeWorkspace =
    workspaces?.find((w) => w.status === "active" || w.status === "trial") ?? null;
  const trial = computeTrialInfo(activeWorkspace);

  useEffect(() => {
    if (!workspaces) return;
    if (workspaces.length === 0) navigate({ to: "/onboarding", replace: true });
  }, [workspaces, navigate]);

  // Realtime updates for recovery events
  useEffect(() => {
    if (!activeWorkspace) return;
    const channel = supabase
      .channel(`ws-${activeWorkspace.id}-events`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recovery_events",
          filter: `workspace_id=eq.${activeWorkspace.id}`,
        },
        () => {
          void statsQuery.refetch();
          void eventsQuery.refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const stats = useServerFn(getRecoveryStats);
  const events = useServerFn(listRecoveryEvents);

  const statsQuery = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-stats", activeWorkspace?.id],
    queryFn: () => stats({ data: { workspaceId: activeWorkspace!.id } }),
    refetchInterval: 30000,
  });
  const s = statsQuery.data;

  const eventsQuery = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-events-dashboard", activeWorkspace?.id],
    queryFn: () => events({ data: { workspaceId: activeWorkspace!.id, limit: 6 } }),
    refetchInterval: 30000,
  });
  const recentEvents = eventsQuery.data ?? [];

  const engineOn = !!activeWorkspace?.recovery_engine_enabled;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <TrialReminderBanner trial={trial} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {activeWorkspace?.name ?? "Dashboard"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recovery engine {engineOn ? "active" : "offline"} · Real-time overview
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkspaceStatusBadge status={activeWorkspace?.status} />
          <TrialBadge trial={trial} />
          {!engineOn && (
            <Button asChild size="sm">
              <Link to="/getting-started">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Activate engine
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Primary KPIs */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiLink to="/analytics">
          <StatCard
            icon={<TrendingUp className="size-4" />}
            label="Recovered revenue"
            value={money(s?.recoveredAmountCents ?? 0, s?.currency)}
            loading={statsQuery.isLoading}
          />
        </KpiLink>
        <KpiLink to="/analytics">
          <StatCard
            icon={<Sparkles className="size-4" />}
            label="Recovery rate"
            value={`${Math.round((s?.recoveryRate ?? 0) * 100)}%`}
            loading={statsQuery.isLoading}
          />
        </KpiLink>
        <KpiLink to="/events">
          <StatCard
            icon={<Activity className="size-4" />}
            label="Failed payments"
            value={s?.total ?? 0}
            loading={statsQuery.isLoading}
          />
        </KpiLink>
        <KpiLink to="/events">
          <StatCard
            icon={<CheckCircle2 className="size-4" />}
            label="Recovered customers"
            value={s?.recovered ?? 0}
            loading={statsQuery.isLoading}
          />
        </KpiLink>
      </section>

      {/* Secondary status row */}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatusTile
          to="/events"
          icon={<Zap className="size-4" />}
          label="Recovery queue"
          value={`${(s?.total ?? 0) - (s?.recovered ?? 0)} open`}
          hint="Awaiting attempt"
        />
        <StatusTile
          to="/events"
          icon={<Activity className="size-4" />}
          label="Today's activity"
          value={`${recentEvents.length} events`}
          hint="Last 24h"
        />
        <StatusTile
          to="/integrations"
          icon={<Plug className="size-4" />}
          label="Active integrations"
          value={engineOn ? "Live" : "Setup needed"}
          hint="Stores, gateways, channels"
        />
        <StatusTile
          to="/platform/system-health"
          icon={<Bot className="size-4" />}
          label="AI & system"
          value="Operational"
          hint="Providers, webhooks, health"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent events */}
        <section className="rounded-2xl border border-border/60 bg-card/50 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium">Recent events</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/events">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {eventsQuery.isLoading ? (
            <ul className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted/70" />
                </li>
              ))}
            </ul>
          ) : recentEvents.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {recentEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/events"
                    className="flex items-start justify-between gap-4 px-5 py-3.5 transition hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.customer?.email ?? e.customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {e.ai_summary ?? e.failure_message ?? e.failure_code ?? "Analyzing…"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <StatusBadge status={e.status} />
                        <span className="text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">
                        {money(e.amount_cents, e.currency)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Mail className="size-5" />}
              title="No activity yet"
              description="Connect your payment gateway to start recovering failed payments automatically."
              action={
                <Button asChild size="sm">
                  <Link to="/integrations">
                    Configure integrations
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              }
            />
          )}
        </section>

        {/* Quick actions */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Jump into common workflows.
            </p>
            <div className="mt-4 grid gap-2">
              <QuickAction to="/integrations" icon={<Plug className="size-4" />} label="Connect store" />
              <QuickAction to="/integrations" icon={<CreditCard className="size-4" />} label="Connect payment" />
              <QuickAction to="/recovery-strategy" icon={<Sparkles className="size-4" />} label="Configure AI strategy" />
              <QuickAction to="/team" icon={<Handshake className="size-4" />} label="Invite member" />
              <QuickAction to="/admin/email/sandbox" icon={<Mail className="size-4" />} label="Send test email" />
              <QuickAction to="/settings/ai" icon={<Bot className="size-4" />} label="Run AI test" />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
            <h2 className="text-sm font-semibold">Explore</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <ExploreLink to="/analytics" icon={<BarChart3 className="size-3.5" />} label="Analytics" />
              <ExploreLink to="/events" icon={<Activity className="size-3.5" />} label="Recovery events" />
              <ExploreLink to="/notifications" icon={<Bell className="size-3.5" />} label="Notifications" />
              <ExploreLink to="/billing/statements" icon={<Receipt className="size-3.5" />} label="Invoices" />
              <ExploreLink to="/integrations/whatsapp" icon={<MessageSquare className="size-3.5" />} label="WhatsApp" />
              <ExploreLink to="/team" icon={<Users className="size-3.5" />} label="Team & roles" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to as never} className="block transition hover:opacity-90">
      {children}
    </Link>
  );
}

function StatusTile({
  to,
  icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      to={to as never}
      className="group rounded-xl border border-border/60 bg-card/50 p-4 transition hover:border-primary/40 hover:bg-card"
    >
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wide">
          {icon}
          {label}
        </span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

function QuickAction({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className="h-9 justify-start gap-2">
      <Link to={to as never}>
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ArrowRight className="h-3 w-3 opacity-60" />
      </Link>
    </Button>
  );
}

function ExploreLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowRight className="h-3 w-3 opacity-60" />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    analyzing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    recovering: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    recovered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    abandoned: "bg-muted text-muted-foreground",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
        map[status] ?? "bg-muted"
      }`}
    >
      {status}
    </span>
  );
}

// Keep imports referenced for icons used only in optional branches
void RefreshCw;
