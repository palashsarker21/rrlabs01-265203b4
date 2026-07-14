import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Sparkles, RefreshCw, Mail, MessageCircle, Settings, TrendingUp, Shield, CheckCircle2, Circle, Zap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { TrialBadge, TrialReminderBanner, WorkspaceStatusBadge } from "@/components/trial-badge";
import { computeTrialInfo } from "@/lib/trial";
import {
  getRecoveryStats,
  listRecoveryEvents,
  retryRecoveryEvent,
} from "@/lib/recovery.functions";
import { getMyAdminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
  head: () => ({
    meta: [
      { title: "Dashboard — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
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
        .select("id, name, slug, status, recovery_engine_enabled, setup_step, trial_ends_at, trial_started_at, subscription_status")
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
      return;
    }
    if (trial.isExpired) {
      navigate({ to: "/upgrade", search: { reason: "trial_expired" }, replace: true });
    }
  }, [workspaces, trial.isExpired, navigate]);


  const stats = useServerFn(getRecoveryStats);
  const events = useServerFn(listRecoveryEvents);
  const retry = useServerFn(retryRecoveryEvent);
  const adminStatus = useServerFn(getMyAdminStatus);
  const { data: me } = useQuery({ queryKey: ["admin-status"], queryFn: () => adminStatus({}) });

  const { data: statsData } = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-stats", activeWorkspace?.id],
    queryFn: () => stats({ data: { workspaceId: activeWorkspace!.id } }),
    refetchInterval: 15000,
  });

  const { data: eventsData, refetch: refetchEvents } = useQuery({
    enabled: !!activeWorkspace,
    queryKey: ["recovery-events", activeWorkspace?.id],
    queryFn: () => events({ data: { workspaceId: activeWorkspace!.id, limit: 50 } }),
    refetchInterval: 15000,
  });

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
      await refetchEvents();
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.profile?.display_name ?? profile?.user?.email}
            </span>
            {me?.isSuperAdmin ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link to="/setup">
                <Settings className="mr-2 h-4 w-4" />
                Integrations
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <TrialReminderBanner trial={trial} />

        <section className="rounded-2xl border border-border/60 bg-card/50 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Welcome to {activeWorkspace?.name ?? "your workspace"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Recovery engine {activeWorkspace?.recovery_engine_enabled ? "on" : "off"} · get started below
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WorkspaceStatusBadge status={activeWorkspace?.status} />
              <TrialBadge trial={trial} />
              {trial.isTrial ? (
                <Button asChild size="sm">
                  <Link to="/upgrade">Upgrade</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Recovered revenue" value={money(statsData?.recoveredAmountCents ?? 0, statsData?.currency)} />
            <StatCard label="Failed payments" value={statsData?.total ?? 0} />
            <StatCard
              label="Recovery rate"
              value={`${Math.round((statsData?.recoveryRate ?? 0) * 100)}%`}
              accent
            />
            <StatCard label="Messages sent" value={statsData?.recovered ?? 0} />
          </div>
        </section>

        <GettingStartedChecklist workspaceId={activeWorkspace?.id} setupStep={activeWorkspace?.setup_step ?? 0} engineOn={!!activeWorkspace?.recovery_engine_enabled} />


        <section className="rounded-2xl border border-border/60 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Recovery events</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Live · updates every 15s
            </span>
          </div>

          {eventsData && eventsData.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {eventsData.map((e) => (
                <li key={e.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {e.customer?.email ?? e.customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.ai_summary ?? e.failure_message ?? e.failure_code ?? "Analyzing…"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <StatusBadge status={e.status} />
                        {e.failure_category ? (
                          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                            {e.failure_category.replace(/_/g, " ")}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {e.attempts_count ?? 0}{" "}
                          {(e.attempts_count ?? 0) === 1 ? "attempt" : "attempts"}
                        </span>
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
            <EmptyState workspaceId={activeWorkspace?.id} />
          )}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <h3 className="text-sm font-medium text-foreground">Stripe webhook URL</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste this URL in your Stripe dashboard → Developers → Webhooks. Select events
            <code className="mx-1">payment_intent.payment_failed</code>,
            <code className="mx-1">invoice.payment_failed</code>,
            <code className="mx-1">charge.failed</code>,
            <code className="mx-1">payment_intent.succeeded</code>,
            <code className="mx-1">invoice.payment_succeeded</code>. Copy the signing secret
            into the Stripe integration.
          </p>
          {activeWorkspace ? (
            <code className="mt-3 block break-all rounded bg-background/60 p-3 text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}
              /api/public/webhooks/stripe?w={activeWorkspace.id}
            </code>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/40"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
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
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

function EmptyState({ workspaceId }: { workspaceId?: string }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Mail className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-foreground">
        No recovery events yet
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Connect Stripe to this workspace and configure the webhook above. Failed payments will
        appear here and be recovered automatically.
      </p>
      {workspaceId ? (
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          Recovery messages send via your connected email and WhatsApp channels.
        </p>
      ) : null}
    </div>
  );
}
