import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  LogOut,
  Plug,
  ShieldCheck,
  Zap,
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
  listAdapterCatalog,
  listWorkspaceIntegrations,
  saveIntegration,
  setSetupStep,
  testIntegration,
} from "@/lib/integrations.functions";
import type { AdapterInfo } from "@/lib/integrations/catalog";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [{ title: "Set up your workspace — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  component: SetupWizard,
});

type IntegrationRow = {
  id: string;
  workspace_id: string;
  kind: "payment_gateway" | "communication" | "store";
  provider: string;
  display_name: string | null;
  status: "connected" | "disconnected" | "pending" | "error";
  config: Record<string, unknown>;
  health: string | null;
  last_verified_at: string | null;
  last_error: string | null;
};

const STEPS = [
  { key: "payment", title: "Connect payments", icon: Plug, kind: "payment_gateway" as const },
  {
    key: "email",
    title: "Set up email",
    icon: Zap,
    kind: "communication" as const,
    provider: "resend",
  },
  {
    key: "whatsapp",
    title: "Add WhatsApp",
    icon: ShieldCheck,
    kind: "communication" as const,
    provider: "whatsapp_cloud",
    optional: true,
  },
  { key: "review", title: "Review & activate", icon: CheckCircle2 },
];

function SetupWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const fetchCatalog = useServerFn(listAdapterCatalog);
  const fetchList = useServerFn(listWorkspaceIntegrations);
  const saveFn = useServerFn(saveIntegration);
  const testFn = useServerFn(testIntegration);
  const disconnectFn = useServerFn(disconnectIntegration);
  const activateFn = useServerFn(activateWorkspace);
  const stepFn = useServerFn(setSetupStep);

  // Workspace to configure — first workspace the user manages.
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
    if (!wsLoading && !workspace) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [wsLoading, workspace, navigate]);

  useEffect(() => {
    if (workspace?.status === "active") {
      navigate({ to: "/app", replace: true });
    }
    if (workspace?.setup_step && workspace.setup_step > 0 && workspace.setup_step <= 3) {
      setStepIndex(workspace.setup_step);
    }
  }, [workspace, navigate]);

  const { data: catalog } = useQuery({
    queryKey: ["adapter-catalog"],
    queryFn: () => fetchCatalog(),
    staleTime: Infinity,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => fetchList({ data: { workspaceId: workspace!.id } }) as Promise<IntegrationRow[]>,
  });

  const paymentAdapters = useMemo(
    () => (catalog ?? []).filter((a) => a.kind === "payment_gateway"),
    [catalog],
  );
  const emailAdapter = useMemo(
    () => (catalog ?? []).find((a) => a.provider === "resend"),
    [catalog],
  );
  const waAdapter = useMemo(
    () => (catalog ?? []).find((a) => a.provider === "whatsapp_cloud"),
    [catalog],
  );

  async function persistStep(step: number) {
    if (!workspace?.id) return;
    await stepFn({ data: { workspaceId: workspace.id, step } });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function goNext() {
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    await persistStep(next);
  }
  function goBack() {
    setStepIndex((s) => Math.max(s - 1, 0));
  }

  async function onSave(provider: string, credentials: Record<string, string>) {
    if (!workspace?.id) return;
    const res = await saveFn({ data: { workspaceId: workspace.id, provider, credentials } });
    if (res.ok) {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["integrations", workspace.id] });
    } else {
      toast.error(res.message);
    }
    return res.ok;
  }

  async function onTest(integrationId: string) {
    const res = await testFn({ data: { integrationId } });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
  }

  async function onDisconnect(integrationId: string) {
    await disconnectFn({ data: { integrationId } });
    toast.success("Integration disconnected.");
    qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button size="sm" variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Let's get {workspace?.name ?? "your workspace"} recovering revenue
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect your billing and messaging channels. Every credential is encrypted at rest and
          never sent back to your browser.
        </p>

        <Stepper current={stepIndex} steps={STEPS.map((s) => s.title)} />

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
          {stepIndex === 0 && (
            <PaymentStep
              adapters={paymentAdapters}
              integrations={integrations.filter((i) => i.kind === "payment_gateway")}
              onSave={onSave}
              onTest={onTest}
              onDisconnect={onDisconnect}
            />
          )}
          {stepIndex === 1 && emailAdapter && (
            <AdapterStep
              adapter={emailAdapter}
              integration={integrations.find((i) => i.provider === emailAdapter.provider)}
              onSave={onSave}
              onTest={onTest}
              onDisconnect={onDisconnect}
            />
          )}
          {stepIndex === 2 && waAdapter && (
            <AdapterStep
              adapter={waAdapter}
              integration={integrations.find((i) => i.provider === waAdapter.provider)}
              onSave={onSave}
              onTest={onTest}
              onDisconnect={onDisconnect}
              optional
            />
          )}
          {stepIndex === 3 && <ReviewStep integrations={integrations} onActivate={onActivate} />}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {stepIndex < STEPS.length - 1 ? (
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

function PaymentStep(props: {
  adapters: AdapterInfo[];
  integrations: IntegrationRow[];
  onSave: (provider: string, creds: Record<string, string>) => Promise<boolean | undefined>;
  onTest: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const primary = props.adapters[0];
  const existing = props.integrations.find((i) => i.provider === primary?.provider);
  if (!primary)
    return <p className="text-sm text-muted-foreground">No payment adapters available.</p>;
  return (
    <AdapterStep
      adapter={primary}
      integration={existing}
      onSave={props.onSave}
      onTest={props.onTest}
      onDisconnect={props.onDisconnect}
    />
  );
}

function AdapterStep(props: {
  adapter: AdapterInfo;
  integration?: IntegrationRow;
  onSave: (provider: string, creds: Record<string, string>) => Promise<boolean | undefined>;
  onTest: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
  optional?: boolean;
}) {
  const { adapter, integration, optional } = props;
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Prefill non-secret fields from stored public config.
    const initial: Record<string, string> = {};
    for (const f of adapter.fields) {
      if (!f.secret && integration?.config && typeof integration.config[f.key] === "string") {
        initial[f.key] = integration.config[f.key] as string;
      }
    }
    setValues(initial);
  }, [adapter, integration]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await props.onSave(adapter.provider, values);
    } finally {
      setSubmitting(false);
    }
  }

  const connected = integration?.status === "connected";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{adapter.name}</h2>
            {optional && (
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Optional
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{adapter.description}</p>
          {adapter.docsUrl && (
            <a
              href={adapter.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-primary hover:underline"
            >
              Where to find these credentials →
            </a>
          )}
        </div>
        <StatusPill integration={integration} />
      </div>

      {connected && integration && (
        <div className="mt-6 rounded-lg border border-border/60 bg-background/40 p-4">
          <h3 className="text-sm font-medium text-foreground">Connected</h3>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {Object.entries(integration.config ?? {}).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 rounded bg-card/40 px-3 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate text-foreground">{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => props.onTest(integration.id)}>
              Re-test connection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => props.onDisconnect(integration.id)}>
              Disconnect
            </Button>
          </div>
          {integration.last_error && (
            <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
              <CircleAlert className="h-3.5 w-3.5" /> {integration.last_error}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {adapter.fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>
              {f.label}
              {f.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Input
              id={f.key}
              type={f.type === "password" ? "password" : f.type === "email" ? "email" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              autoComplete={f.secret ? "off" : undefined}
              className="mt-2"
            />
            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : connected ? (
            "Update & re-verify"
          ) : (
            "Connect"
          )}
        </Button>
      </form>
    </div>
  );
}

function StatusPill({ integration }: { integration?: IntegrationRow }) {
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
        "rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

function ReviewStep({
  integrations,
  onActivate,
}: {
  integrations: IntegrationRow[];
  onActivate: () => void;
}) {
  const payment = integrations.find(
    (i) => i.kind === "payment_gateway" && i.status === "connected",
  );
  const comms = integrations.filter((i) => i.kind === "communication" && i.status === "connected");
  const ready = Boolean(payment) && comms.length > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Review your setup</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Activating turns on the recovery engine. It will begin monitoring failed payments and
        dispatching recovery flows immediately.
      </p>

      <ul className="mt-6 space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <StatusDot ok={Boolean(payment)} />
          <span className="text-foreground">Payment gateway</span>
          <span className="text-muted-foreground">
            {payment ? `${payment.display_name} connected` : "Not connected — required"}
          </span>
        </li>
        <li className="flex items-center gap-3">
          <StatusDot ok={comms.length > 0} />
          <span className="text-foreground">Communication channels</span>
          <span className="text-muted-foreground">
            {comms.length === 0
              ? "Connect at least one channel"
              : comms.map((c) => c.display_name ?? c.provider).join(", ")}
          </span>
        </li>
      </ul>

      <div className="mt-8">
        <Button size="lg" onClick={onActivate} disabled={!ready}>
          Activate recovery engine
        </Button>
        {!ready && (
          <p className="mt-2 text-xs text-muted-foreground">
            Finish the missing steps above to enable activation.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        ok ? "bg-emerald-500" : "bg-muted-foreground/50",
      )}
    />
  );
}
