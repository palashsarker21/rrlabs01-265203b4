import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  Sparkles,
  RefreshCw,
  Mail,
  Settings,
  TrendingUp,
  Shield,
  CheckCircle2,
  Circle,
  ArrowRight,
  Activity,
  Users,

} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { TrialBadge, TrialReminderBanner, WorkspaceStatusBadge } from "@/components/trial-badge";
import { computeTrialInfo } from "@/lib/trial";
import { getRecoveryStats, listRecoveryEvents, retryRecoveryEvent } from "@/lib/recovery.functions";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { BillingPanel } from "@/components/billing/billing-panel";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
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

function AppShell() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      return { user: userData.user, profile: data };
    },
  });

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
    if (workspaces.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [workspaces, navigate]);

  const stats = useServerFn(getRecoveryStats);
  const events = useServerFn(listRecoveryEvents);
  const retry = useServerFn(retryRecoveryEvent);
  const adminStatus = useServerFn(getMyAdminStatus);
  const { data: me } = useQuery({ queryKey: ["admin-status"], queryFn: () => adminStatus({}) });

  const statsQuery = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-stats", activeWorkspace?.id],
    queryFn: () => stats({ data: { workspaceId: activeWorkspace!.id } }),
    refetchInterval: 15000,
  });
  const statsData = statsQuery.data;

  const eventsQuery = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-events", activeWorkspace?.id],
    queryFn: () => events({ data: { workspaceId: activeWorkspace!.id, limit: 10 } }),
    refetchInterval: 15000,
  });
  const eventsData = eventsQuery.data;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleRetry(eventId: string) {
    try {
      const { toast } = await import("sonner");
      await retry({ data: { eventId } });
      toast.success("Recovery attempt queued.");
      await eventsQuery.refetch();
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    }
  }

  const setupStep = activeWorkspace?.setup_step ?? 0;
  const engineOn = !!activeWorkspace?.recovery_engine_enabled;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {profile?.profile?.display_name ?? profile?.user?.email}
            </span>
            {me?.isSuperAdmin ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin" aria-label="Admin">
                  <Shield className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link to="/team" aria-label="Team">
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Team</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/setup" aria-label="Settings">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <TrialReminderBanner trial={trial} />

        {/* Welcome */}
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground">
                Welcome to {activeWorkspace?.name ?? "your workspace"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Recovery engine {engineOn ? "on" : "off"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WorkspaceStatusBadge status={activeWorkspace?.status} />
            <TrialBadge trial={trial} />
            <Button asChild size="sm" variant="outline">
              <Link to="/events">
                <Sparkles className="mr-2 h-4 w-4" />
                Events
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/analytics">
                <Sparkles className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
            {!engineOn && (
              <Button asChild size="sm" variant="default">
                <Link to="/getting-started">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Guided setup
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* KPIs */}
        <section
          aria-label="Key metrics"
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
        >
          <StatCard
            label="Recovered revenue"
            value={money(statsData?.recoveredAmountCents ?? 0, statsData?.currency)}
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Failed payments"
            value={statsData?.total ?? 0}
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Recovery rate"
            value={`${Math.round((statsData?.recoveryRate ?? 0) * 100)}%`}
            accent
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Messages sent"
            value={statsData?.recovered ?? 0}
            loading={statsQuery.isLoading}
          />
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-border/60 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
            </div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>

          {eventsQuery.isLoading ? (
            <ul className="divide-y divide-border/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-5 py-4 sm:px-6">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted/70" />
                </li>
              ))}
            </ul>
          ) : eventsData && eventsData.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {eventsData.map((e) => (
                <li key={e.id} className="px-5 py-4 sm:px-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {e.customer?.email ?? e.customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {e.ai_summary ?? e.failure_message ?? e.failure_code ?? "Analyzing…"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge status={e.status} />
                        <span className="text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {money(e.amount_cents, e.currency)}
                      </span>
                      {e.status !== "recovered" && e.status !== "abandoned" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(e.id)}
                          aria-label="Retry recovery"
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState />
          )}
        </section>

        {activeWorkspace ? <BillingPanel workspaceId={activeWorkspace.id} /> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <GettingStarted setupStep={setupStep} engineOn={engineOn} />
          <SystemHealth engineOn={engineOn} />
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <p className={`mt-2 text-2xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
      )}
    </div>
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
      className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${
        map[status] ?? "bg-muted"
      }`}
    >
      {status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground">No activity yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        Connect your payment gateway to start recovering failed payments automatically.
      </p>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to="/setup">
          Configure integrations
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function GettingStarted({ setupStep, engineOn }: { setupStep: number; engineOn: boolean }) {
  const items = [
    { key: "store", title: "Connect Store", done: setupStep >= 1 },
    { key: "payment", title: "Connect Payment", done: setupStep >= 2 },
    { key: "email", title: "Connect Email", done: setupStep >= 3 },
    { key: "ai", title: "Activate Recovery", done: engineOn },
  ];
  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / items.length) * 100);

  if (pct === 100) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Getting started</h2>
        <span className="text-xs font-medium text-muted-foreground">{pct}% complete</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-5 space-y-2">
        {items.map((a) => (
          <li
            key={a.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {a.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              )}
              <span
                className={`truncate text-sm ${
                  a.done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {a.title}
              </span>
            </div>
            {!a.done ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/setup">
                  Set up
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SystemHealth({ engineOn }: { engineOn: boolean }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">System health</h2>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/status">
            Details
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <HealthRow label="Recovery engine" ok={engineOn} okText="Online" offText="Idle" />
        <HealthRow label="Webhooks" ok={true} okText="Receiving" offText="—" />
        <HealthRow label="AI Gateway" ok={true} okText="Operational" offText="—" />
      </ul>
    </section>
  );
}

function HealthRow({
  label,
  ok,
  okText,
  offText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  offText: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <span className="text-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
        />
        {ok ? okText : offText}
      </span>
    </li>
  );
}
