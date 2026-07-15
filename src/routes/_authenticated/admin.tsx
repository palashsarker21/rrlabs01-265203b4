import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Power, ArrowLeft, ScrollText, Building2, ToggleLeft, Plug, DollarSign, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import {
  getAdminOverview,
  getMyAdminStatus,
  adminSetEngine,
  listAuditLogs,
} from "@/lib/admin.functions";
import { getBillingMetrics } from "@/lib/billing-summary.functions";
import {
  listFeatureFlags,
  setFeatureFlag,
  listProvidersAdmin,
  setProviderEnabled,
} from "@/lib/admin-features.functions";
import { getAdminPricingSnapshot } from "@/lib/admin-pricing.functions";
import { formatSuccessFeeBps } from "@/lib/pricing";


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminConsole,
  head: () => ({
    meta: [{ title: "Admin console — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
});

function money(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n / 100);
}

function AdminConsole() {
  const navigate = useNavigate();
  const status = useServerFn(getMyAdminStatus);
  const overview = useServerFn(getAdminOverview);
  const audit = useServerFn(listAuditLogs);
  const setEngine = useServerFn(adminSetEngine);
  const metricsFn = useServerFn(getBillingMetrics);
  const pricingFn = useServerFn(getAdminPricingSnapshot);
  const [tab, setTab] = useState<"workspaces" | "audit" | "pricing">("workspaces");

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status({}),
  });

  useEffect(() => {
    if (!meLoading && me && !me.isSuperAdmin) {
      navigate({ to: "/app", replace: true });
    }
  }, [me, meLoading, navigate]);

  const { data: workspaces, refetch: refetchWorkspaces } = useQuery({
    enabled: !!me?.isSuperAdmin,
    queryKey: ["admin-overview"],
    queryFn: () => overview({}),
  });

  const { data: logs } = useQuery({
    enabled: !!me?.isSuperAdmin,
    queryKey: ["admin-audit"],
    queryFn: () => audit({ data: { limit: 100 } }),
    refetchInterval: 30000,
  });

  const { data: billing } = useQuery({
    enabled: !!me?.isSuperAdmin,
    queryKey: ["admin-billing-metrics"],
    queryFn: () => metricsFn({}),
    refetchInterval: 60000,
  });

  const { data: pricing } = useQuery({
    enabled: !!me?.isSuperAdmin && tab === "pricing",
    queryKey: ["admin-pricing"],
    queryFn: () => pricingFn({}),
  });

  const totals = useMemo(() => {
    const list = workspaces ?? [];
    return {
      count: list.length,
      active: list.filter((w) => w.status === "active").length,
      events: list.reduce((s, w) => s + Number(w.events_count ?? 0), 0),
      recovered: list.reduce((s, w) => s + Number(w.recovered_amount_cents ?? 0), 0),
    };
  }, [workspaces]);

  async function toggleEngine(id: string, next: boolean) {
    try {
      const { toast } = await import("sonner");
      await setEngine({ data: { workspaceId: id, enabled: next } });
      toast.success(`Recovery engine ${next ? "enabled" : "disabled"}.`);
      await refetchWorkspaces();
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  }

  if (meLoading || !me) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!me.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLockup />
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Admin
            </span>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/app">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="rounded-2xl border border-border/60 bg-card/50 p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Admin console</h1>
              <p className="text-sm text-muted-foreground">
                Tenant overview, recovery engine controls, and audit trail.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Workspaces" value={totals.count} />
            <Stat label="Active" value={totals.active} />
            <Stat label="Recovery events" value={totals.events} />
            <Stat label="Recovered value" value={money(totals.recovered)} accent />
          </div>
        </section>

        {billing ? (
          <section className="rounded-2xl border border-border/60 bg-card/50 p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Billing health</h2>
                <p className="text-sm text-muted-foreground">Lemon Squeezy — updated every 60s.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="MRR" value={money(billing.mrrCents)} accent />
              <Stat label="ARR" value={money(billing.arrCents)} />
              <Stat label="Active customers" value={billing.activeCount} />
              <Stat label="Trials" value={billing.trialCount} />
              <Stat label="Cancelled (30d)" value={billing.cancelled30dCount} />
              <Stat label="Trial → paid" value={`${Math.round(billing.conversionRate * 100)}%`} />
              <Stat label="Recovered revenue" value={money(billing.recoveredCents)} />
              <Stat label="Past due" value={billing.pastDueCount} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Webhooks (24h)
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="font-medium">{billing.webhooks.total24h}</span> received
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {billing.webhooks.processed24h} processed
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {billing.webhooks.pending24h} pending
                  </span>
                  <span className="text-rose-600 dark:text-rose-400">
                    {billing.webhooks.failed24h} failed
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Checkout success rate (30d)
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">
                    {Math.round(billing.checkout.successRate * 100)}%
                  </span>{" "}
                  <span className="text-muted-foreground">
                    ({billing.checkout.completed30d}/{billing.checkout.total30d})
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="flex items-center gap-2 border-b border-border/60">
          <TabButton active={tab === "workspaces"} onClick={() => setTab("workspaces")}>
            <Building2 className="mr-2 h-4 w-4" /> Workspaces
          </TabButton>
          <TabButton active={tab === "audit"} onClick={() => setTab("audit")}>
            <ScrollText className="mr-2 h-4 w-4" /> Audit log
          </TabButton>
          <TabButton active={tab === "pricing"} onClick={() => setTab("pricing")}>
            <DollarSign className="mr-2 h-4 w-4" /> Pricing config
          </TabButton>
        </div>



        {tab === "pricing" ? (
          <PricingConfigPanel data={pricing} />
        ) : tab === "workspaces" ? (
          <section className="rounded-2xl border border-border/60 bg-card/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Workspace</th>
                    <th className="px-4 py-3 text-left">Org</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Members</th>
                    <th className="px-4 py-3 text-right">Integrations</th>
                    <th className="px-4 py-3 text-right">Events</th>
                    <th className="px-4 py-3 text-right">Recovered</th>
                    <th className="px-4 py-3 text-right">Engine</th>
                  </tr>
                </thead>
                <tbody>
                  {(workspaces ?? []).map((w) => (
                    <tr key={w.workspace_id} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{w.workspace_name}</div>
                        <div className="text-xs text-muted-foreground">{w.workspace_slug}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.organization_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{Number(w.members_count ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(w.active_integrations_count ?? 0)}/
                        {Number(w.integrations_count ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">{Number(w.events_count ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        {money(Number(w.recovered_amount_cents ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={w.recovery_engine_enabled ? "default" : "outline"}
                          onClick={() => toggleEngine(w.workspace_id, !w.recovery_engine_enabled)}
                        >
                          <Power className="mr-1.5 h-3.5 w-3.5" />
                          {w.recovery_engine_enabled ? "On" : "Off"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!workspaces || workspaces.length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                        No workspaces yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border/60 bg-card/50">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Target</th>
                    <th className="px-4 py-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-border/60 align-top">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.actor_email ?? l.actor_id?.slice(0, 8) ?? "system"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {l.target_type ? `${l.target_type}:${l.target_id?.slice(0, 8) ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <code className="whitespace-pre-wrap break-all">
                          {Object.keys(l.details ?? {}).length ? JSON.stringify(l.details) : "—"}
                        </code>
                      </td>
                    </tr>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        No audit entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PricingConfigPanel({
  data,
}: {
  data:
    | Awaited<ReturnType<typeof getAdminPricingSnapshot>>
    | undefined;
}) {
  if (!data) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/50 p-8 text-sm text-muted-foreground">
        Loading pricing configuration…
      </section>
    );
  }
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Trial length</div>
            <div className="mt-1 font-medium text-foreground">{data.trialDays} days</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Lemon Squeezy store
            </div>
            <div className="mt-1 font-medium text-foreground">
              {data.storeId ? data.storeId : <span className="text-rose-500">Not configured</span>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Webhook secret
            </div>
            <div className="mt-1 font-medium">
              {data.webhookSecretConfigured ? (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <Check className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-500">
                  <X className="h-4 w-4" /> Missing
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Display copy comes from <code className="font-mono">src/lib/pricing.ts</code> (PLANS).
          Checkout binds to the <code className="font-mono">plans</code> table by{" "}
          <code className="font-mono">code</code>; the resolved LS variant id is read from the
          matching environment variable.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Display price</th>
                <th className="px-4 py-3 text-left">Success fee</th>
                <th className="px-4 py-3 text-left">CTA</th>
                <th className="px-4 py-3 text-left">DB plan</th>
                <th className="px-4 py-3 text-left">LS variant</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(({ plan, dbPlan, lsVariantEnvKey, lsVariantConfigured }) => {
                const dbMatches =
                  dbPlan &&
                  dbPlan.code === plan.code &&
                  (plan.monthlyBaseCents == null ||
                    dbPlan.price_cents === plan.monthlyBaseCents) &&
                  (plan.successFeeBps == null ||
                    dbPlan.success_fee_bps === plan.successFeeBps);
                return (
                  <tr key={plan.code} className="border-t border-border/60 align-top">
                    <td className="px-4 py-3 font-mono text-xs">{plan.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">{plan.tagline}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {plan.price}
                        {plan.priceSuffix ?? ""}
                      </div>
                      {plan.priceLead ? (
                        <div className="text-xs text-muted-foreground">{plan.priceLead}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div>{formatSuccessFeeBps(plan.successFeeBps)}</div>
                      <div className="text-xs text-muted-foreground">{plan.successFee}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono">{plan.cta.kind}</div>
                      <div className="text-muted-foreground">{plan.cta.label}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {dbPlan ? (
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-1">
                            {dbMatches ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span className="font-mono">{dbPlan.code}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {(dbPlan.price_cents / 100).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                            })}
                            {" · "}
                            {formatSuccessFeeBps(dbPlan.success_fee_bps)}
                            {" · trial "}
                            {dbPlan.trial_days}d
                          </div>
                          {!dbPlan.is_active ? (
                            <div className="text-amber-500">inactive</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-rose-500">Missing row</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {lsVariantEnvKey ? (
                        <div className="space-y-1">
                          <div className="font-mono">{lsVariantEnvKey}</div>
                          <div>
                            {lsVariantConfigured ? (
                              <span className="inline-flex items-center gap-1 text-emerald-500">
                                <Check className="h-3.5 w-3.5" /> configured
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500">
                                <X className="h-3.5 w-3.5" /> missing env
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            db id: {dbPlan?.ls_variant_id ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">n/a (contact sales)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

