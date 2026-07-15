import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  LogOut,
  Plug,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import {
  activateWorkspace,
  disconnectIntegration,
  listWorkspaceIntegrations,
  saveIntegration,
  setSetupStep,
  testIntegration,
} from "@/lib/integrations.functions";
import {
  listProviderCatalog,
  getWorkspaceLimits,
  rotateWebhookSecret,
  listWorkspaceProviderStatuses,
  listWebhookLogs,
  revealWebhookSecret,
} from "@/lib/providers.functions";
import type { ProviderKind } from "@/lib/providers/kinds";
import { PROVIDER_STEP_ORDER, integrationKindFor } from "@/lib/providers/kinds";
import { webhookUrl, getBrowserOrigin } from "@/lib/providers/webhook-url";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [{ title: "Integration Center — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  component: IntegrationCenter,
});

type ProviderRow = Awaited<ReturnType<typeof listProviderCatalog>>[number];
type IntegrationRow = Awaited<ReturnType<typeof listWorkspaceIntegrations>>[number];
type ProviderStatusRow = Awaited<ReturnType<typeof listWorkspaceProviderStatuses>>[number];
type SetupField = {
  key: string;
  label?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

function IntegrationCenter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const fetchCatalog = useServerFn(listProviderCatalog);
  const fetchList = useServerFn(listWorkspaceIntegrations);
  const fetchLimits = useServerFn(getWorkspaceLimits);
  const saveFn = useServerFn(saveIntegration);
  const testFn = useServerFn(testIntegration);
  const disconnectFn = useServerFn(disconnectIntegration);
  const rotateFn = useServerFn(rotateWebhookSecret);
  const statusesFn = useServerFn(listWorkspaceProviderStatuses);
  const logsFn = useServerFn(listWebhookLogs);
  const revealFn = useServerFn(revealWebhookSecret);
  const activateFn = useServerFn(activateWorkspace);
  const stepFn = useServerFn(setSetupStep);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["setup-workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, status, setup_step, recovery_engine_enabled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!wsLoading && !workspace) navigate({ to: "/onboarding", replace: true });
  }, [wsLoading, workspace, navigate]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["provider-catalog"],
    queryFn: () => fetchCatalog(),
    staleTime: 60_000,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => fetchList({ data: { workspaceId: workspace!.id } }),
  });

  const { data: limits = [] } = useQuery({
    queryKey: ["provider-limits", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => fetchLimits({ data: { workspaceId: workspace!.id } }),
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["provider-statuses", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => statusesFn({ data: { workspaceId: workspace!.id } }),
    refetchInterval: 15_000,
  });
  const statusByIntegration = useMemo(() => {
    const m = new Map<string, ProviderStatusRow>();
    for (const s of statuses) m.set(s.integration_id, s);
    return m;
  }, [statuses]);

  const currentStep = PROVIDER_STEP_ORDER[stepIndex];
  const currentKind = currentStep?.kind;

  const providersForKind = useMemo(
    () => catalog.filter((p) => p.kind === currentKind).sort((a, b) => a.sort_order - b.sort_order),
    [catalog, currentKind],
  );

  const limitForKind = useMemo(
    () => limits.find((l) => l.kind === currentKind),
    [limits, currentKind],
  );

  const overLimit = limitForKind?.max != null && limitForKind.used >= limitForKind.max;

  async function persistStep(step: number) {
    if (!workspace?.id) return;
    await stepFn({ data: { workspaceId: workspace.id, step } }).catch(() => undefined);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function goNext() {
    const next = Math.min(stepIndex + 1, PROVIDER_STEP_ORDER.length);
    setStepIndex(next);
    await persistStep(next);
  }
  function goBack() {
    setStepIndex((s) => Math.max(s - 1, 0));
  }

  async function onSave(provider: string, creds: Record<string, string>) {
    if (!workspace?.id) return false;
    try {
      const res = await saveFn({
        data: { workspaceId: workspace.id, provider, credentials: creds },
      });
      if (res.ok) {
        toast.success(res.message);
        qc.invalidateQueries({ queryKey: ["integrations", workspace.id] });
        qc.invalidateQueries({ queryKey: ["provider-limits", workspace.id] });
        return true;
      }
      toast.error(res.message);
      return false;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
      return false;
    }
  }

  async function onTest(id: string) {
    const res = await testFn({ data: { integrationId: id } });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
    qc.invalidateQueries({ queryKey: ["provider-statuses", workspace?.id] });
  }

  async function onDisconnect(id: string) {
    await disconnectFn({ data: { integrationId: id } });
    toast.success("Integration disconnected.");
    qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
    qc.invalidateQueries({ queryKey: ["provider-limits", workspace?.id] });
  }

  async function onRotate(id: string) {
    const res = await rotateFn({ data: { integrationId: id } });
    toast.success(`New signing secret generated.`);
    qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
    return res.secret;
  }

  async function onActivate() {
    if (!workspace?.id) return;
    try {
      await activateFn({ data: { workspaceId: workspace.id } });
      toast.success("Workspace activated. Recovery engine is now on.");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not activate.");
    }
  }

  const stepTitles = [...PROVIDER_STEP_ORDER.map((s) => s.title), "Activation review"];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button size="sm" variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Integration Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect a store, a payment gateway, an email service, and (optionally) WhatsApp or SMS.
          Every credential is encrypted at rest and each connection gets its own signed webhook URL.
        </p>

        <Stepper current={stepIndex} steps={stepTitles} />

        <div className="mt-8 space-y-4">
          {currentStep ? (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{currentStep.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{currentStep.description}</p>
                </div>
                {limitForKind && (
                  <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground">
                    {limitForKind.used} / {limitForKind.max ?? "∞"} used
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {providersForKind.map((p) => {
                  const rows = integrations.filter(
                    (i) =>
                      i.provider === p.code &&
                      i.kind === integrationKindFor(p.kind as ProviderKind),
                  );
                  return (
                    <ProviderCard
                      key={p.code}
                      provider={p}
                      integrations={rows}
                      statusByIntegration={statusByIntegration}
                      overLimit={overLimit && rows.length === 0}
                      onSave={onSave}
                      onTest={onTest}
                      onDisconnect={onDisconnect}
                      onRotate={onRotate}
                      onFetchLogs={(id) => logsFn({ data: { integrationId: id, limit: 20 } })}
                      onReveal={(id) => revealFn({ data: { integrationId: id } })}
                    />
                  );
                })}
                {providersForKind.length === 0 && (
                  <div className="col-span-2 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                    No providers available in this step.
                  </div>
                )}
              </div>
            </>
          ) : (
            <ActivationReview
              integrations={integrations}
              limits={limits}
              catalog={catalog}
              statuses={statuses}
              onActivate={onActivate}
            />

          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {stepIndex < PROVIDER_STEP_ORDER.length ? (
            <Button onClick={goNext}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mt-8 flex flex-wrap items-center gap-3">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-primary/10 text-primary",
                !done && !active && "border-border/60 text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border/60" />}
          </li>
        );
      })}
    </ol>
  );
}

function ProviderCard({
  provider,
  integrations,
  statusByIntegration,
  overLimit,
  onSave,
  onTest,
  onDisconnect,
  onRotate,
  onFetchLogs,
  onReveal,
}: {
  provider: ProviderRow;
  integrations: IntegrationRow[];
  statusByIntegration: Map<string, ProviderStatusRow>;
  overLimit: boolean;
  onSave: (provider: string, creds: Record<string, string>) => Promise<boolean>;
  onTest: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onRotate: (id: string) => Promise<string | undefined>;
  onFetchLogs: (id: string) => Promise<
    {
      id: string;
      event_type: string | null;
      status_code: number | null;
      signature_valid: boolean;
      error: string | null;
      received_at: string;
      attempt_count: number;
    }[]
  >;
  onReveal: (id: string) => Promise<{ secret: string | null; verifyToken: string | null }>;
}) {
  const [expanded, setExpanded] = useState(integrations.length === 0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const disabled = !provider.enabled;
  const setupFields = Array.isArray(provider.setup_fields)
    ? (provider.setup_fields as unknown as SetupField[])
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || overLimit) return;
    setSubmitting(true);
    try {
      const okSaved = await onSave(provider.code, values);
      if (okSaved) {
        setValues({});
        setExpanded(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/50 p-5",
        disabled || overLimit ? "border-border/40 opacity-95" : "border-border/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{provider.name}</h3>
            {provider.beta && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                Beta
              </span>
            )}
            {disabled && (
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Disabled
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
          {provider.docs_url && (
            <a
              href={provider.docs_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Setup guide <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <StatusChip integration={integrations[0]} disabled={disabled || overLimit} />
      </div>

      {(disabled || overLimit) && (
        <UpgradeBadge
          reason={disabled ? "Provider not yet enabled for your workspace." : "Plan limit reached."}
          overLimit={overLimit}
        />
      )}

      {integrations.length > 0 && (
        <div className="mt-4 space-y-3">
          {integrations.map((i) => (
            <ConnectedRow
              key={i.id}
              integration={i}
              provider={provider}
              status={statusByIntegration.get(i.id)}
              onTest={onTest}
              onDisconnect={onDisconnect}
              onRotate={onRotate}
              onFetchLogs={onFetchLogs}
              onReveal={onReveal}
            />
          ))}
        </div>
      )}

      {!disabled && !overLimit && (
        <div className="mt-4">
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : integrations.length ? "Add another account" : "Connect"}
          </button>
          {expanded && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              {provider.setup_instructions && (
                <p className="rounded-md bg-background/40 p-3 text-xs text-muted-foreground">
                  {provider.setup_instructions}
                </p>
              )}
              {setupFields.map((f) => (
                <div key={f.key}>
                  <Label htmlFor={`${provider.code}-${f.key}`} className="text-xs">
                    {f.label ?? f.key}
                    {f.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  {f.type === "select" && f.options ? (
                    <select
                      id={`${provider.code}-${f.key}`}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select…</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`${provider.code}-${f.key}`}
                      type={
                        f.type === "password"
                          ? "password"
                          : f.type === "url"
                            ? "url"
                            : f.type === "email"
                              ? "email"
                              : f.type === "number"
                                ? "number"
                                : "text"
                      }
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      autoComplete="off"
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Plug className="mr-2 h-3.5 w-3.5" /> Connect
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedRow({
  integration,
  provider,
  status,
  onTest,
  onDisconnect,
  onRotate,
  onFetchLogs,
  onReveal,
}: {
  integration: IntegrationRow;
  provider: ProviderRow;
  status: ProviderStatusRow | undefined;
  onTest: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  onRotate: (id: string) => Promise<string | undefined>;
  onFetchLogs: (id: string) => Promise<
    {
      id: string;
      event_type: string | null;
      status_code: number | null;
      signature_valid: boolean;
      error: string | null;
      received_at: string;
      attempt_count: number;
    }[]
  >;
  onReveal: (id: string) => Promise<{ secret: string | null; verifyToken: string | null }>;
}) {
  const [testing, setTesting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealed, setRevealed] = useState<{
    secret: string | null;
    verifyToken: string | null;
  } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<
    | {
        id: string;
        event_type: string | null;
        status_code: number | null;
        signature_valid: boolean;
        error: string | null;
        received_at: string;
        attempt_count: number;
      }[]
    | null
  >(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const origin = getBrowserOrigin();
  const url = origin ? webhookUrl(origin, provider.code, integration.id) : "";
  const requiredScopes = Array.isArray(provider.required_scopes)
    ? (provider.required_scopes as string[])
    : [];
  const needsVerifyToken =
    provider.code === "meta_wa" || provider.code === "twilio_wa" || provider.code === "twilio_sms";

  async function copy(t: string, label: string) {
    try {
      await navigator.clipboard.writeText(t);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function toggleReveal() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await onReveal(integration.id);
      setRevealed(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reveal secret.");
    } finally {
      setRevealing(false);
    }
  }

  async function toggleLogs() {
    if (logsOpen) {
      setLogsOpen(false);
      return;
    }
    setLogsOpen(true);
    if (logs === null) {
      setLoadingLogs(true);
      try {
        setLogs(await onFetchLogs(integration.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load logs.");
        setLogs([]);
      } finally {
        setLoadingLogs(false);
      }
    }
  }

  const retryCount = status?.retry_count ?? 0;
  const lastDelivery = status?.last_delivery_at ?? null;
  const lastSuccess = status?.last_success_at ?? null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {integration.display_name ?? provider.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {integration.provider_account_id ?? integration.id.slice(0, 8)} · created{" "}
            {timeAgo(integration.created_at)}
          </p>
        </div>
        <StatusChip integration={integration} />
      </div>

      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Webhook URL:</span>
          <code className="flex-1 truncate rounded bg-card/60 px-2 py-1 font-mono">
            {url || "…"}
          </code>
          <button
            className="rounded p-1 hover:bg-card/70"
            onClick={() => copy(url, "Webhook URL")}
            title="Copy webhook URL"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Signing secret:</span>
          <code className="flex-1 truncate rounded bg-card/60 px-2 py-1 font-mono">
            {revealed?.secret ? revealed.secret : "•••••••••••••••••••••"}
          </code>
          <button
            className="rounded p-1 hover:bg-card/70"
            onClick={toggleReveal}
            title={revealed ? "Hide" : "Reveal"}
            disabled={revealing}
          >
            {revealing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : revealed ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </button>
          {revealed?.secret && (
            <button
              className="rounded p-1 hover:bg-card/70"
              onClick={() => copy(revealed.secret!, "Signing secret")}
              title="Copy secret"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>

        {needsVerifyToken && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Verify token:</span>
            <code className="flex-1 truncate rounded bg-card/60 px-2 py-1 font-mono">
              {revealed?.verifyToken ?? "•••••••••••"}
            </code>
            {revealed?.verifyToken && (
              <button
                className="rounded p-1 hover:bg-card/70"
                onClick={() => copy(revealed.verifyToken!, "Verify token")}
                title="Copy verify token"
              >
                <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>
            Verification:{" "}
            <span className={verifCls(integration.verification_status)}>
              {integration.verification_status ?? "pending"}
            </span>
          </span>
          {lastDelivery && <span>· Last delivery {timeAgo(lastDelivery)}</span>}
          {lastSuccess && <span>· Last success {timeAgo(lastSuccess)}</span>}
          {integration.last_test_at && <span>· Tested {timeAgo(integration.last_test_at)}</span>}
          {retryCount > 0 && <span className="text-amber-500">· {retryCount} retries</span>}
        </div>

        {requiredScopes.length > 0 && (
          <div className="text-muted-foreground">
            Required scopes:{" "}
            <span className="font-mono text-foreground">{requiredScopes.join(", ")}</span>
          </div>
        )}

        {(integration.last_error || status?.last_error) && (
          <p className="text-destructive">{integration.last_error ?? status?.last_error}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            setTesting(true);
            try {
              await onTest(integration.id);
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3 w-3" />
          )}
          Test connection
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            setRotating(true);
            try {
              const secret = await onRotate(integration.id);
              if (secret) {
                setRevealed({ secret, verifyToken: revealed?.verifyToken ?? null });
                copy(secret, "New signing secret");
              }
            } finally {
              setRotating(false);
            }
          }}
        >
          {rotating ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-3 w-3" />
          )}
          Rotate secret
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleLogs}>
          <FileText className="mr-2 h-3 w-3" />
          {logsOpen ? "Hide logs" : "View logs"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDisconnect(integration.id)}>
          <Trash2 className="mr-2 h-3 w-3" /> Disconnect
        </Button>
      </div>

      {logsOpen && (
        <div className="mt-3 rounded-md border border-border/60 bg-card/40 p-3 text-[11px]">
          {loadingLogs ? (
            <p className="text-muted-foreground">Loading recent deliveries…</p>
          ) : logs && logs.length > 0 ? (
            <ul className="space-y-1 font-mono">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2">
                  {l.signature_valid && l.status_code && l.status_code < 400 ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                  )}
                  <span className="w-20 shrink-0 text-muted-foreground">
                    {new Date(l.received_at).toLocaleTimeString()}
                  </span>
                  <span className="w-32 shrink-0 truncate">{l.event_type ?? "—"}</span>
                  <span className="w-10 shrink-0">{l.status_code ?? "—"}</span>
                  <span className="w-14 shrink-0 text-muted-foreground">x{l.attempt_count}</span>
                  {l.error && <span className="flex-1 truncate text-destructive">{l.error}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No webhook deliveries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({
  integration,
  disabled,
}: {
  integration?: IntegrationRow;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Locked
      </span>
    );
  }
  const status = integration?.status ?? "disconnected";
  const map: Record<string, string> = {
    connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    error: "bg-destructive/15 text-destructive border-destructive/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    disconnected: "bg-muted text-muted-foreground border-border/60",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

function UpgradeBadge({ reason, overLimit }: { reason: string; overLimit: boolean }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      <Lock className="mt-0.5 h-3.5 w-3.5 text-primary" />
      <div className="flex-1">
        <p className="font-medium text-foreground">
          {overLimit ? "Upgrade required" : "Not available"}
        </p>
        <p className="mt-0.5 text-muted-foreground">{reason}</p>
        {overLimit && (
          <Link
            to="/pricing"
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            View plans →
          </Link>
        )}
      </div>
    </div>
  );
}

function ActivationReview({
  integrations,
  limits,
  catalog,
  onActivate,
}: {
  integrations: IntegrationRow[];
  limits: { kind: ProviderKind; used: number; max: number | null }[];
  catalog: ProviderRow[];
  onActivate: () => void;
}) {
  const codesByKind = (kind: ProviderKind) =>
    catalog.filter((c) => c.kind === kind).map((c) => c.code);
  const connectedCount = (kind: ProviderKind) => {
    const codes = codesByKind(kind);
    return integrations.filter((i) => i.status === "connected" && codes.includes(i.provider))
      .length;
  };
  const checks = [
    { label: "Store connected", ok: connectedCount("store") > 0 },
    { label: "Payment gateway connected", ok: connectedCount("gateway") > 0 },
    { label: "Email connected", ok: connectedCount("email") > 0 },
    {
      label: "WhatsApp / SMS connected (optional)",
      ok: connectedCount("messaging") > 0,
      optional: true,
    },
    {
      label: "Webhooks verified",
      ok: integrations.some(
        (i) => i.status === "connected" && i.verification_status === "verified",
      ),
    },
    {
      label: "Test passed on every connection",
      ok:
        integrations.filter((i) => i.status === "connected").length > 0 &&
        integrations.filter((i) => i.status === "connected").every((i) => i.last_test_ok === true),
    },
  ];
  const requiredOk = checks.filter((c) => !c.optional).every((c) => c.ok);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
      <h2 className="text-lg font-semibold text-foreground">Activation review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every check below has to pass before the recovery engine can be turned on.
      </p>

      <ul className="mt-6 space-y-3 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3">
            <CheckCircle2
              className={cn("h-4 w-4", c.ok ? "text-emerald-500" : "text-muted-foreground/40")}
            />
            <span className="text-foreground">{c.label}</span>
            {c.optional && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Optional
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {limits.map((l) => (
          <div key={l.kind} className="rounded-lg border border-border/60 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l.kind}</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {l.used} / {l.max ?? "∞"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Button size="lg" onClick={onActivate} disabled={!requiredOk}>
          Activate recovery engine
        </Button>
        {!requiredOk && (
          <p className="mt-2 text-xs text-muted-foreground">
            Finish the missing steps above to enable activation.
          </p>
        )}
      </div>
    </div>
  );
}

function verifCls(status: string | null | undefined) {
  if (status === "verified") return "text-emerald-500";
  if (status === "failed") return "text-destructive";
  return "text-muted-foreground";
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
