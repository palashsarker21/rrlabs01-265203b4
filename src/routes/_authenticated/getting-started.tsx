import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Store,
  CreditCard,
  Mail,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CircleDashed,
  Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { listWorkspaceIntegrations, testIntegration } from "@/lib/integrations.functions";
import {
  listProviderCatalog,
  listWorkspaceProviderStatuses,
} from "@/lib/providers.functions";
import { PROVIDER_STEP_ORDER, type ProviderKind } from "@/lib/providers/kinds";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/getting-started")({
  head: () => ({
    meta: [
      { title: "Guided Setup — RRLabs" },
      { name: "description", content: "Real-time verified onboarding for your RRLabs workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GettingStartedPage,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Integration = {
  id: string;
  workspace_id: string;
  kind: string;
  provider: string;
  provider_account_id: string | null;
  display_name: string | null;
  status: string | null;
  config: Record<string, unknown> | null;
  health: string | null;
  verification_status: string | null;
  last_verified_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type VerifyState = "verified" | "failed" | "pending" | "auth_failed" | "testing" | "unconfigured";

type CardStatus = {
  state: VerifyState;
  label: string;
  tone: "green" | "yellow" | "red" | "blue" | "gray";
};

/* ------------------------------------------------------------------ */
/* Status derivation                                                   */
/* ------------------------------------------------------------------ */

function deriveStatus(i: Integration | undefined, testing: boolean): CardStatus {
  if (testing) return { state: "testing", label: "Testing…", tone: "blue" };
  if (!i) return { state: "unconfigured", label: "Not configured", tone: "gray" };
  if (i.status === "connected" && i.verification_status === "verified" && i.last_test_ok) {
    return { state: "verified", label: "Verified", tone: "green" };
  }
  const err = (i.last_error ?? "").toLowerCase();
  if (
    err.includes("auth") ||
    err.includes("unauthorized") ||
    err.includes("permission") ||
    err.includes("invalid api key") ||
    err.includes("invalid key")
  ) {
    return { state: "auth_failed", label: "Authentication failed", tone: "red" };
  }
  if (i.status === "error" || i.last_test_ok === false) {
    return { state: "failed", label: "Connection failed", tone: "red" };
  }
  if (i.verification_status === "pending" || i.status === "pending") {
    return { state: "pending", label: "Pending verification", tone: "yellow" };
  }
  return { state: "pending", label: "Needs attention", tone: "yellow" };
}

const TONE_STYLES: Record<CardStatus["tone"], { dot: string; text: string; bg: string; ring: string }> = {
  green: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  yellow: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  red: {
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    ring: "ring-red-500/20",
  },
  blue: {
    dot: "bg-blue-500 animate-pulse",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/20",
  },
  gray: {
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    bg: "bg-muted",
    ring: "ring-border/60",
  },
};

const KIND_META: Record<ProviderKind, { icon: typeof Store; helper: string }> = {
  store: {
    icon: Store,
    helper: "Shopify, WooCommerce or another storefront — so we know which carts to recover.",
  },
  gateway: {
    icon: CreditCard,
    helper: "Stripe, PayPal or another processor — so we hear failed payments in real time.",
  },
  email: {
    icon: Mail,
    helper: "Postmark, Resend or SES — used to deliver recovery emails.",
  },
  messaging: {
    icon: MessageSquare,
    helper: "Twilio or WhatsApp — optional, but boosts recovery on high-value carts.",
  },
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function GettingStartedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkspaceIntegrations);
  const catalogFn = useServerFn(listProviderCatalog);
  const statusesFn = useServerFn(listWorkspaceProviderStatuses);
  const testFn = useServerFn(testIntegration);
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toISOString());

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["gs-workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, status, recovery_engine_enabled, setup_step, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: integrations = [], isFetching: intFetching } = useQuery<Integration[]>({
    enabled: !!workspace?.id,
    queryKey: ["gs-integrations", workspace?.id],
    queryFn: async () => (await listFn({ data: { workspaceId: workspace!.id } })) as Integration[],
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["gs-catalog"],
    queryFn: () => catalogFn({}),
    staleTime: 5 * 60_000,
  });

  const { data: providerStatuses = [] } = useQuery({
    enabled: !!workspace?.id,
    queryKey: ["gs-provider-statuses", workspace?.id],
    queryFn: () => statusesFn({ data: { workspaceId: workspace!.id } }),
    refetchInterval: 45_000,
  });

  // Realtime: refetch on any integration or provider_status change for this workspace.
  useEffect(() => {
    if (!workspace?.id) return;
    const wsId = workspace.id;
    const ch = supabase
      .channel(`gs-${wsId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "integrations", filter: `workspace_id=eq.${wsId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["gs-integrations", wsId] });
          qc.invalidateQueries({ queryKey: ["gs-provider-statuses", wsId] });
          setLastRefreshedAt(new Date().toISOString());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_status" },
        () => {
          qc.invalidateQueries({ queryKey: ["gs-provider-statuses", wsId] });
          setLastRefreshedAt(new Date().toISOString());
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspace?.id, qc]);

  useEffect(() => {
    if (!intFetching) setLastRefreshedAt(new Date().toISOString());
  }, [intFetching]);

  const providerKindMap = useMemo(() => {
    const m = new Map<string, ProviderKind>();
    for (const p of catalog) m.set(p.provider, p.kind as ProviderKind);
    return m;
  }, [catalog]);

  const providerNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalog) m.set(p.provider, p.name ?? p.provider);
    return m;
  }, [catalog]);

  const statusMap = useMemo(() => {
    const m = new Map<string, (typeof providerStatuses)[number]>();
    for (const s of providerStatuses) m.set(s.integration_id, s);
    return m;
  }, [providerStatuses]);

  // Group integrations by kind, keeping only best per kind for display purposes.
  const byKind = useMemo(() => {
    const g: Record<ProviderKind, Integration[]> = {
      store: [],
      gateway: [],
      email: [],
      messaging: [],
    };
    for (const i of integrations) {
      const kind = providerKindMap.get(i.provider);
      if (kind) g[kind].push(i);
    }
    return g;
  }, [integrations, providerKindMap]);

  const verifiedByKind: Record<ProviderKind, boolean> = {
    store: byKind.store.some((i) => deriveStatus(i, false).state === "verified"),
    gateway: byKind.gateway.some((i) => deriveStatus(i, false).state === "verified"),
    email: byKind.email.some((i) => deriveStatus(i, false).state === "verified"),
    messaging: byKind.messaging.some((i) => deriveStatus(i, false).state === "verified"),
  };

  // Store OR Gateway satisfies the "revenue source" requirement.
  const revenueSourceSatisfied = verifiedByKind.store || verifiedByKind.gateway;
  const emailSatisfied = verifiedByKind.email;
  const allRequiredDone = revenueSourceSatisfied && emailSatisfied;
  const engineActive = !!workspace?.recovery_engine_enabled;

  // Readiness score (0-100). Weighted:
  //   revenue source (store or gateway) verified : 30
  //   email verified                              : 25
  //   both store AND gateway verified             : +10
  //   messaging verified                          : +10
  //   no webhook errors in the last 24h           : +10
  //   workspace not expired/suspended             : +10
  //   recovery engine active                      : +5
  const readinessScore = useMemo(() => {
    let s = 0;
    if (revenueSourceSatisfied) s += 30;
    if (emailSatisfied) s += 25;
    if (verifiedByKind.store && verifiedByKind.gateway) s += 10;
    if (verifiedByKind.messaging) s += 10;
    const recentErr = providerStatuses.some((p) => {
      if (!p.last_error) return false;
      const t = p.updated_at ? Date.parse(p.updated_at) : 0;
      return Date.now() - t < 24 * 3600_000;
    });
    if (!recentErr) s += 10;
    if (workspace?.status && !["expired", "suspended", "cancelled"].includes(workspace.status)) {
      s += 10;
    }
    if (engineActive) s += 5;
    return Math.max(0, Math.min(100, s));
  }, [
    revenueSourceSatisfied,
    emailSatisfied,
    verifiedByKind.store,
    verifiedByKind.gateway,
    verifiedByKind.messaging,
    providerStatuses,
    workspace?.status,
    engineActive,
  ]);

  const issuesFound = useMemo(() => {
    return integrations.filter((i) => {
      const st = deriveStatus(i, false).state;
      return st === "failed" || st === "auth_failed";
    }).length;
  }, [integrations]);

  const needsAttention = useMemo(() => {
    return integrations.filter((i) => deriveStatus(i, false).state === "pending").length;
  }, [integrations]);

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => testFn({ data: { integrationId: id } }),
    onMutate: (id) => setTestingIds((m) => ({ ...m, [id]: true })),
    onSettled: (_res, _err, id) => {
      setTestingIds((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["gs-integrations", workspace?.id] });
      qc.invalidateQueries({ queryKey: ["gs-provider-statuses", workspace?.id] });
    },
    onSuccess: (res) => {
      if (res.ok) toast.success(res.message || "Connection verified.");
      else toast.error(res.message || "Verification failed.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Verification failed.");
    },
  });

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ["gs-integrations", workspace?.id] });
    qc.invalidateQueries({ queryKey: ["gs-provider-statuses", workspace?.id] });
  };

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const missingList: string[] = [];
  if (!revenueSourceSatisfied) missingList.push("Connect a verified store or payment gateway");
  if (!emailSatisfied) missingList.push("Connect a verified email delivery provider");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <BrandLockup />
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10">
          {/* Header */}
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Guided setup</span>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                Let's get {workspace?.name ?? "your workspace"} ready
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Every step is verified live against the provider. Progress only moves forward when
                a real backend check succeeds.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={intFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", intFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Top summary */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Readiness score"
              value={`${readinessScore}%`}
              tone={
                readinessScore >= 80 ? "green" : readinessScore >= 50 ? "yellow" : "red"
              }
              hint={
                readinessScore >= 80
                  ? "System ready"
                  : readinessScore >= 50
                    ? "Almost there"
                    : "Needs setup"
              }
            />
            <SummaryCard
              label="Connection health"
              value={
                issuesFound === 0 && needsAttention === 0
                  ? "Healthy"
                  : issuesFound > 0
                    ? "Degraded"
                    : "Warning"
              }
              tone={issuesFound > 0 ? "red" : needsAttention > 0 ? "yellow" : "green"}
              hint={
                issuesFound > 0
                  ? `${issuesFound} failing`
                  : needsAttention > 0
                    ? `${needsAttention} pending`
                    : "All checks passing"
              }
            />
            <SummaryCard
              label="Issues found"
              value={String(issuesFound)}
              tone={issuesFound > 0 ? "red" : "green"}
              hint={issuesFound > 0 ? "Review failing connections" : "None"}
            />
            <SummaryCard
              label="Last verification"
              value={timeAgo(lastRefreshedAt)}
              tone="gray"
              hint="Auto-refresh every 45s"
              icon={Clock}
            />
          </section>

          {/* Connection requirement panel */}
          <section className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Connection requirement
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  At least one Store <span className="text-muted-foreground">OR</span> one Payment
                  Gateway
                </div>
              </div>
              <div
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium ring-1",
                  revenueSourceSatisfied
                    ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
                )}
              >
                {revenueSourceSatisfied ? "Satisfied" : "Not satisfied"}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RequirementRow
                icon={Store}
                label="Store connected"
                verified={verifiedByKind.store}
              />
              <RequirementRow
                icon={CreditCard}
                label="Payment gateway connected"
                verified={verifiedByKind.gateway}
              />
            </div>
            {revenueSourceSatisfied && !(verifiedByKind.store && verifiedByKind.gateway) && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Recommended:</span> for the best
                recovery performance, connect <em>both</em> a store and a payment gateway.
              </p>
            )}
          </section>

          {/* Integration cards */}
          <section className="mt-8 space-y-4">
            {PROVIDER_STEP_ORDER.map((step) => {
              const kindIntegrations = byKind[step.kind];
              const meta = KIND_META[step.kind];
              const Icon = meta.icon;
              const isMessaging = step.kind === "messaging";
              const kindVerified = verifiedByKind[step.kind];

              // If nothing configured, show a single "not configured" card.
              if (kindIntegrations.length === 0) {
                return (
                  <IntegrationCard
                    key={step.kind}
                    icon={Icon}
                    title={step.title}
                    helper={meta.helper}
                    optional={isMessaging}
                    status={{ state: "unconfigured", label: "Not configured", tone: "gray" }}
                    onSetup={() => navigate({ to: "/integrations", hash: `step-${step.kind}` })}
                  />
                );
              }

              return kindIntegrations.map((i) => {
                const testing = !!testingIds[i.id];
                const status = deriveStatus(i, testing);
                const ps = statusMap.get(i.id);
                const providerLabel = providerNameMap.get(i.provider) ?? i.provider;
                return (
                  <IntegrationCard
                    key={i.id}
                    icon={Icon}
                    title={i.display_name || providerLabel}
                    helper={meta.helper}
                    optional={isMessaging}
                    kindLabel={step.title}
                    kindVerified={kindVerified}
                    status={status}
                    provider={providerLabel}
                    environment={
                      (i.config as { environment?: string; region?: string } | null)
                        ?.environment ?? null
                    }
                    region={
                      (i.config as { region?: string } | null)?.region ?? null
                    }
                    account={i.provider_account_id}
                    connectedSince={i.created_at}
                    lastVerified={i.last_verified_at ?? i.last_test_at}
                    lastSync={ps?.last_delivery_at ?? ps?.last_success_at ?? null}
                    error={i.last_error}
                    onVerify={() => verifyMutation.mutate(i.id)}
                    onManage={() => navigate({ to: "/integrations", hash: `step-${step.kind}` })}
                    verifying={testing}
                  />
                );
              });
            })}
          </section>

          {/* Activate */}
          <section className="mt-10 rounded-2xl border border-border/60 bg-card/50 p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Activate the Recovery Engine</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Activation unlocks once at least one revenue source (store or gateway) and an email
              provider are backend-verified.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                {engineActive ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Recovery Engine is active.
                    </span>
                  </>
                ) : allRequiredDone ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-foreground">Requirements met — you're ready.</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">
                      {missingList[0] ?? "Finish required steps to unlock activation."}
                    </span>
                  </>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      disabled={!allRequiredDone && !engineActive}
                      onClick={() =>
                        navigate({
                          to: engineActive ? "/integrations" : "/getting-started/complete",
                        })
                      }
                    >
                      {engineActive ? "View integrations" : "Review & activate"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!allRequiredDone && !engineActive && (
                  <TooltipContent side="top">
                    <div className="max-w-xs">
                      <div className="text-xs font-medium">Missing requirements</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        {missingList.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </section>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Need help?{" "}
            <Link to="/app" className="underline hover:text-foreground">
              Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function SummaryCard(props: {
  label: string;
  value: string;
  hint: string;
  tone: "green" | "yellow" | "red" | "gray";
  icon?: typeof Clock;
}) {
  const t = TONE_STYLES[props.tone];
  const Icon = props.icon;
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {props.label}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", t.text)}>{props.value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div>
    </div>
  );
}

function RequirementRow(props: { icon: typeof Store; label: string; verified: boolean }) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        props.verified
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/60 bg-background",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          props.verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}
      />
      <div className="flex-1 text-sm text-foreground">{props.label}</div>
      {props.verified ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <CircleDashed className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: CardStatus }) {
  const t = TONE_STYLES[status.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        t.bg,
        t.text,
        t.ring,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {status.label}
    </span>
  );
}

function IntegrationCard(props: {
  icon: typeof Store;
  title: string;
  helper: string;
  optional?: boolean;
  kindLabel?: string;
  kindVerified?: boolean;
  status: CardStatus;
  provider?: string;
  environment?: string | null;
  region?: string | null;
  account?: string | null;
  connectedSince?: string | null;
  lastVerified?: string | null;
  lastSync?: string | null;
  error?: string | null;
  onVerify?: () => void;
  onManage?: () => void;
  onSetup?: () => void;
  verifying?: boolean;
}) {
  const Icon = props.icon;
  const isVerified = props.status.state === "verified";
  const isFailed = props.status.state === "failed" || props.status.state === "auth_failed";
  const isConfigured = props.status.state !== "unconfigured";

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        isVerified
          ? "border-emerald-500/30 bg-emerald-500/[0.03]"
          : isFailed
            ? "border-red-500/30 bg-red-500/[0.03]"
            : "border-border/60 bg-card/40",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
            isVerified
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : isFailed
                ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-border/60 bg-muted text-muted-foreground",
          )}
        >
          {isVerified ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : isFailed ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{props.title}</h3>
            {props.optional ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Optional
              </span>
            ) : (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                Required
              </span>
            )}
            <StatusPill status={props.status} />
          </div>

          <p className="mt-1 text-sm text-muted-foreground">{props.helper}</p>

          {isConfigured && (
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Provider" value={props.provider} />
              <DetailRow
                label="Environment"
                value={props.environment ?? "production"}
              />
              {props.region && <DetailRow label="Region" value={props.region} />}
              {props.account && <DetailRow label="Account" value={props.account} />}
              <DetailRow label="Connected" value={formatDate(props.connectedSince)} />
              <DetailRow label="Last verified" value={timeAgo(props.lastVerified)} />
              <DetailRow label="Last sync" value={timeAgo(props.lastSync)} />
              <DetailRow
                label="Health"
                value={isVerified ? "Healthy" : isFailed ? "Unhealthy" : "Unknown"}
              />
            </dl>
          )}

          {props.error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400">
                    Backend error
                  </div>
                  <p className="mt-0.5 break-words text-xs text-red-600/90 dark:text-red-400/90">
                    {props.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {props.optional && !isConfigured && (
            <p className="mt-3 text-xs text-muted-foreground">
              Not connected. Estimated recovery uplift when added:{" "}
              <span className="font-medium text-foreground">+8–14%</span> on high-value carts.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {isConfigured ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={props.onVerify}
                disabled={props.verifying}
              >
                {props.verifying ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Verify connection
              </Button>
              <Button size="sm" variant="ghost" onClick={props.onManage}>
                Manage
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={props.onSetup}>
              Set up
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs text-foreground">{value || "—"}</dd>
    </div>
  );
}
