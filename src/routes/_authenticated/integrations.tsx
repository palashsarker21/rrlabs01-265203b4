import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  Sparkles,
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
import type { SaveResult, SaveFailure } from "@/lib/integrations/errors";
import { computeHealthScore, gradeFor, gradeTone } from "@/lib/integrations/health-score";

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

/**
 * Client-side per-field validator. Returns a human-readable error, or null
 * when the value is acceptable. Server-side validation in `saveIntegration`
 * remains the source of truth; this just catches obvious mistakes before
 * a round-trip.
 */
function validateSetupField(f: SetupField, rawValue: string): string | null {
  const value = (rawValue ?? "").trim();
  const label = f.label ?? f.key;
  if (!value) {
    return f.required ? `${label} is required.` : null;
  }
  if (f.type === "url") {
    try {
      const u = new URL(value);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return `${label} must be an http(s) URL.`;
      }
    } catch {
      return `${label} must be a valid URL (e.g. https://example.com).`;
    }
  }
  if (f.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return `${label} must be a valid email address.`;
    }
  }
  if (f.type === "number") {
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      return `${label} must be a number.`;
    }
  }
  if (f.type === "select" && f.options && !f.options.includes(value)) {
    return `${label} must be one of: ${f.options.join(", ")}.`;
  }
  const k = f.key.toLowerCase();
  if (k.includes("phone") && k.includes("number") && f.type !== "select") {
    if (!value.startsWith("whatsapp:") && !/^\+?[\d\s\-().]{6,}$/.test(value)) {
      return `${label} looks malformed.`;
    }
  }
  return null;
}

function IntegrationCenter() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  

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

  const providersByKind = useMemo(() => {
    const m = new Map<ProviderKind, ProviderRow[]>();
    for (const step of PROVIDER_STEP_ORDER) {
      m.set(
        step.kind,
        catalog.filter((p) => p.kind === step.kind).sort((a, b) => a.sort_order - b.sort_order),
      );
    }
    return m;
  }, [catalog]);

  const limitByKind = useMemo(() => {
    const m = new Map<ProviderKind, (typeof limits)[number]>();
    for (const l of limits) m.set(l.kind as ProviderKind, l);
    return m;
  }, [limits]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function onSave(provider: string, creds: Record<string, string>): Promise<SaveResult> {
    if (!workspace?.id) {
      return {
        ok: false,
        code: "internal",
        message: "No active workspace. Refresh and try again.",
      };
    }
    try {
      const res = (await saveFn({
        data: { workspaceId: workspace.id, provider, credentials: creds },
      })) as SaveResult;
      if (res.ok) {
        toast.success(res.message);
        qc.invalidateQueries({ queryKey: ["integrations", workspace.id] });
        qc.invalidateQueries({ queryKey: ["provider-limits", workspace.id] });
        return res;
      }
      toast.error(res.message, { description: res.hint });
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      toast.error(message);
      return { ok: false, code: "internal", message };
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

  // Mark setup step in the DB as "reached activation" once anything is connected.
  useEffect(() => {
    if (!workspace?.id) return;
    const step = Math.min(integrations.length, PROVIDER_STEP_ORDER.length);
    if ((workspace.setup_step ?? 0) < step) {
      stepFn({ data: { workspaceId: workspace.id, step } }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, integrations.length]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button size="sm" variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Setup</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Complete the four modules below to activate the RRLabs Recovery Engine. Every
              credential is encrypted at rest, changes autosave, and each connection gets its own
              signed webhook URL.
            </p>
          </div>
          {workspace?.recovery_engine_enabled && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              Recovery Engine · Live
            </span>
          )}
        </div>

        <Link
          to="/integrations/whatsapp"
          className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm transition hover:bg-emerald-500/10"
        >
          <div>
            <div className="font-semibold text-foreground">WhatsApp Cloud API — guided onboarding</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Generate the Callback URL, Verify Token, and Webhook Secret Meta needs before you can save WhatsApp credentials here.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
            Open wizard →
          </span>
        </Link>

        <div className="mt-8">
          <ActivationCenter
            integrations={integrations}
            catalog={catalog}
            statuses={statuses}
            engineOn={Boolean(workspace?.recovery_engine_enabled)}
            onActivate={onActivate}
          />
        </div>

        <div className="mt-8 space-y-6">
          {PROVIDER_STEP_ORDER.map((step) => {
            const providers = providersByKind.get(step.kind) ?? [];
            const limit = limitByKind.get(step.kind);
            const connectedInKind = integrations.filter(
              (i) =>
                i.status === "connected" &&
                providers.some((p) => p.code === i.provider),
            ).length;
            const overLimit = limit?.max != null && limit.used >= limit.max;
            return (
              <ModuleSection
                key={step.kind}
                kind={step.kind}
                title={step.title}
                description={step.description}
                connected={connectedInKind}
                limit={limit}
                defaultOpen={connectedInKind === 0}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {providers.map((p) => {
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
                  {providers.length === 0 && (
                    <div className="col-span-2 rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                      No providers available in this module yet.
                    </div>
                  )}
                </div>
              </ModuleSection>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function ModuleSection({
  kind,
  title,
  description,
  connected,
  limit,
  defaultOpen,
  children,
}: {
  kind: ProviderKind;
  title: string;
  description: string;
  connected: number;
  limit?: { used: number; max: number | null };
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ready = connected > 0;
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card/40",
        ready ? "border-emerald-500/30" : "border-border/60",
      )}
      aria-labelledby={`mod-${kind}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
              ready
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                : "border-border/60 text-muted-foreground",
            )}
          >
            {ready ? <Check className="h-4 w-4" /> : <Plug className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h2 id={`mod-${kind}`} className="scroll-mt-24 text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {limit && (
            <span className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
              {limit.used} / {limit.max ?? "∞"}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
              ready
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {ready ? `${connected} connected` : "Not connected"}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && <div className="border-t border-border/60 p-6">{children}</div>}
    </section>
  );
}

function ActivationCenter({
  integrations,
  catalog,
  statuses,
  engineOn,
  onActivate,
}: {
  integrations: IntegrationRow[];
  catalog: ProviderRow[];
  statuses: ProviderStatusRow[];
  engineOn: boolean;
  onActivate: () => void;
}) {
  const codesByKind = (kind: ProviderKind) =>
    catalog.filter((c) => c.kind === kind).map((c) => c.code);
  const connectedCount = (kind: ProviderKind) => {
    const codes = codesByKind(kind);
    return integrations.filter((i) => i.status === "connected" && codes.includes(i.provider))
      .length;
  };
  const connectedIds = new Set(
    integrations.filter((i) => i.status === "connected").map((i) => i.id),
  );
  const failing = statuses.filter(
    (s) => connectedIds.has(s.integration_id) && (s.retry_count ?? 0) > 0,
  );
  const checks = [
    { label: "Store connected", ok: connectedCount("store") > 0 },
    { label: "Payment gateway connected", ok: connectedCount("gateway") > 0 },
    { label: "Email delivery connected", ok: connectedCount("email") > 0 },
    {
      label: "WhatsApp / SMS connected",
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
        integrations
          .filter((i) => i.status === "connected")
          .every((i) => i.last_test_ok === true),
    },
    { label: "No recent webhook failures", ok: failing.length === 0 },
  ];
  const requiredOk = checks.filter((c) => !c.optional).every((c) => c.ok);
  const doneRequired = checks.filter((c) => !c.optional && c.ok).length;
  const totalRequired = checks.filter((c) => !c.optional).length;
  const pct = Math.round((doneRequired / totalRequired) * 100);

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        requiredOk
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Activation Center
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {engineOn
              ? "Recovery Engine is running"
              : requiredOk
                ? "You're ready to activate"
                : "Complete the minimum requirements to activate"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The engine cannot send messages or process failed payments until every required
            check below is green.
          </p>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background/60">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                requiredOk ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {doneRequired} of {totalRequired} required checks complete
          </p>

          <ul className="mt-5 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle
                    className={cn(
                      "h-4 w-4 shrink-0",
                      c.optional ? "text-muted-foreground/40" : "text-muted-foreground/60",
                    )}
                  />
                )}
                <span
                  className={cn(
                    c.ok ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {c.label}
                </span>
                {c.optional && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Optional
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:min-w-[220px]">
          <Button
            size="lg"
            onClick={onActivate}
            disabled={!requiredOk || engineOn}
            className="w-full"
          >
            {engineOn ? "Engine active" : "Activate Recovery Engine"}
          </Button>
          {!requiredOk && !engineOn && (
            <p className="text-center text-xs text-muted-foreground">
              Finish the required checks to enable activation.
            </p>
          )}
          {engineOn && (
            <Link
              to="/app"
              className="text-center text-xs font-medium text-primary hover:underline"
            >
              Go to dashboard →
            </Link>
          )}
        </div>
      </div>
    </div>
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
  onSave: (provider: string, creds: Record<string, string>) => Promise<SaveResult>;
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const disabled = !provider.enabled;
  const setupFields = Array.isArray(provider.setup_fields)
    ? (provider.setup_fields as unknown as SetupField[])
    : [];
  const origin = getBrowserOrigin();
  const previewUrl = origin ? `${origin}/api/public/webhooks/${provider.code}` : "";

  const requiredKeys = useMemo(
    () => setupFields.filter((f) => f.required).map((f) => f.key),
    [setupFields],
  );
  const allRequiredFilled =
    requiredKeys.length > 0 && requiredKeys.every((k) => (values[k] ?? "").trim().length > 0);

  // Per-field client-side validation. Blocks autosave and submit when any
  // rule fails; error text is shown only for fields the user has touched
  // (or all fields after a submit attempt).
  const fieldErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of setupFields) {
      const err = validateSetupField(f, values[f.key] ?? "");
      if (err) out[f.key] = err;
    }
    return out;
  }, [setupFields, values]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSigRef = useRef<string>("");

  // Debounced autosave: fire ~900ms after the user stops editing, once every
  // required field is filled. Server rejects invalid credentials and we surface
  // that as "Save failed" without clearing the form.
  useEffect(() => {
    if (!expanded || disabled || overLimit) return;
    if (!allRequiredFilled || hasFieldErrors) {
      setAutoStatus("idle");
      return;
    }
    const sig = JSON.stringify(values);
    if (sig === lastSavedSigRef.current) return;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(async () => {
      setAutoStatus("saving");
      setSubmitting(true);
      try {
        const res = await onSave(provider.code, values);
        lastSavedSigRef.current = sig;
        if (res.ok) {
          setAutoStatus("saved");
          setSaveError(null);
          setValues({});
          setExpanded(false);
        } else {
          setAutoStatus("failed");
          setSaveError(res);
        }
      } catch {
        setAutoStatus("failed");
      } finally {
        setSubmitting(false);
      }
    }, 900);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, expanded, disabled, overLimit, allRequiredFilled, hasFieldErrors]);

  async function copyPreview() {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopiedPreview(true);
      toast.success("Webhook URL copied.");
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || overLimit) return;
    if (hasFieldErrors) {
      // Surface every error at once and stop.
      const allTouched: Record<string, boolean> = {};
      for (const f of setupFields) allTouched[f.key] = true;
      setTouched(allTouched);
      return;
    }
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setSubmitting(true);
    setAutoStatus("saving");
    try {
      const res = await onSave(provider.code, values);
      if (res.ok) {
        setAutoStatus("saved");
        setSaveError(null);
        setValues({});
        setExpanded(false);
      } else {
        setAutoStatus("failed");
        setSaveError(res);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id={`prov-${provider.code}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-card/50 p-5 transition target:ring-2 target:ring-primary/60",
        disabled || overLimit ? "border-border/40 opacity-95" : "border-border/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{provider.name}</h3>
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
              <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Webhook URL
                </p>
                <div className="flex items-center gap-1">
                  <code className="flex-1 truncate rounded bg-background/60 px-2 py-1 text-[11px] font-mono text-foreground">
                    {previewUrl || "…"}
                  </code>
                  <button
                    type="button"
                    onClick={copyPreview}
                    className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-2 py-1 text-[11px] hover:bg-background"
                    title="Copy webhook URL"
                  >
                    {copiedPreview ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  {provider.docs_url && (
                    <a
                      href={provider.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-border/60 bg-background/60 px-2 py-1 text-[11px] hover:bg-background"
                      title="Open docs"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Docs</span>
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  A unique signed webhook URL is issued per connection after you save. Use the URL
                  above during initial provider setup.
                </p>
              </div>

              <ol className="space-y-1 rounded-md border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground list-decimal list-inside">
                <li>Copy the webhook URL above.</li>
                <li>Paste it into your {provider.name} dashboard.</li>
                <li>Generate a webhook signing secret in {provider.name}.</li>
                <li>Paste the secret and required credentials below.</li>
                <li>Save to receive your unique signed URL and test the connection.</li>
                <li>Activate the workspace once tests pass.</li>
              </ol>

              {provider.setup_instructions && (
                <p className="rounded-md bg-background/40 p-3 text-xs text-muted-foreground">
                  {provider.setup_instructions}
                </p>
              )}
              {setupFields.map((f) => {
                const serverFieldError = saveError?.field === f.key;
                const localError =
                  touched[f.key] && fieldErrors[f.key] ? fieldErrors[f.key] : null;
                const errorMessage = localError ?? (serverFieldError ? saveError!.message : null);
                const fieldHasError = errorMessage !== null;
                const onChangeField = (val: string) => {
                  setValues((v) => ({ ...v, [f.key]: val }));
                  if (serverFieldError) setSaveError(null);
                };
                const onBlurField = () => setTouched((t) => ({ ...t, [f.key]: true }));
                return (
                  <div key={f.key}>
                    <Label htmlFor={`${provider.code}-${f.key}`} className="text-xs">
                      {f.label ?? f.key}
                      {f.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    {f.type === "select" && f.options ? (
                      <select
                        id={`${provider.code}-${f.key}`}
                        value={values[f.key] ?? ""}
                        onChange={(e) => onChangeField(e.target.value)}
                        onBlur={onBlurField}
                        aria-invalid={fieldHasError || undefined}
                        aria-describedby={fieldHasError ? `${provider.code}-${f.key}-err` : undefined}
                        className={cn(
                          "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm",
                          fieldHasError
                            ? "border-destructive ring-1 ring-destructive/40"
                            : "border-border/60",
                        )}
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
                        onChange={(e) => onChangeField(e.target.value)}
                        onBlur={onBlurField}
                        placeholder={f.placeholder}
                        autoComplete="off"
                        aria-invalid={fieldHasError || undefined}
                        aria-describedby={fieldHasError ? `${provider.code}-${f.key}-err` : undefined}
                        className={cn(
                          "mt-1",
                          fieldHasError &&
                            "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/40",
                        )}
                      />
                    )}
                    {errorMessage && (
                      <p
                        id={`${provider.code}-${f.key}-err`}
                        className="mt-1 text-[11px] text-destructive"
                      >
                        {errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}
              {saveError && !saveError.field && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs"
                >
                  <p className="font-medium text-destructive">{saveError.message}</p>
                  {saveError.hint && (
                    <p className="mt-1 text-muted-foreground">{saveError.hint}</p>
                  )}
                  {saveError.docsUrl && (
                    <a
                      href={saveError.docsUrl}
                      target={saveError.docsUrl.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {saveError.code === "plan_limit" ? "View plans" : "Open setup docs"}{" "}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Verifying…
                    </>
                  ) : (
                    <>
                      <Plug className="mr-2 h-3.5 w-3.5" /> Save & verify
                    </>
                  )}
                </Button>
                <span className="text-[11px] text-muted-foreground" aria-live="polite">
                  {autoStatus === "saving" && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Autosaving…
                    </span>
                  )}
                  {autoStatus === "saved" && (
                    <span className="inline-flex items-center gap-1 text-emerald-500">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                  {autoStatus === "failed" && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" /> Save failed
                    </span>
                  )}
                  {autoStatus === "idle" && allRequiredFilled === false && (
                    <span>Fill required fields — changes autosave.</span>
                  )}
                </span>
              </div>

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
  const [copiedUrl, setCopiedUrl] = useState(false);
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

  const healthScore = computeHealthScore({
    status: integration.status,
    verification_status: integration.verification_status,
    last_test_ok: integration.last_test_ok,
    last_test_at: integration.last_test_at,
    last_error: integration.last_error,
    webhook: status
      ? {
          last_delivery_at: status.last_delivery_at,
          last_success_at: status.last_success_at,
          retry_count: status.retry_count,
          last_error: status.last_error,
        }
      : null,
  });
  const healthTone = gradeTone(gradeFor(healthScore));

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
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] font-medium",
              healthTone.text,
            )}
            title={`Health score ${healthScore}/100`}
            aria-label={`Health ${healthTone.label}, score ${healthScore} out of 100`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", healthTone.dot)} />
            {healthScore}
          </span>
          <StatusChip integration={integration} />
        </div>
      </div>

      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Webhook URL:</span>
          <code className="flex-1 truncate rounded bg-card/60 px-2 py-1 font-mono">
            {url || "…"}
          </code>
          <button
            className="inline-flex items-center gap-1 rounded p-1 hover:bg-card/70"
            onClick={async () => {
              await copy(url, "Webhook URL");
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }}
            title="Copy webhook URL"
          >
            {copiedUrl ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500">Copied</span>
              </>
            ) : (
              <Copy className="h-3 w-3" />
            )}
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
