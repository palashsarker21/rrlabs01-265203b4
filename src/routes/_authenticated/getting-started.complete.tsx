import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Rocket,
  Store,
  CreditCard,
  Mail,
  MessageSquare,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { listWorkspaceIntegrations, activateWorkspace } from "@/lib/integrations.functions";
import { listProviderCatalog } from "@/lib/providers.functions";
import { PROVIDER_STEP_ORDER, type ProviderKind } from "@/lib/providers/kinds";

export const Route = createFileRoute("/_authenticated/getting-started/complete")({
  head: () => ({
    meta: [
      { title: "Onboarding complete — RRLabs" },
      { name: "description", content: "Review your setup and activate the Recovery Engine." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingCompletePage,
});

const KIND_META: Record<ProviderKind, { icon: typeof Store; label: string; required: boolean }> = {
  store: { icon: Store, label: "Store", required: true },
  gateway: { icon: CreditCard, label: "Payment gateway", required: true },
  email: { icon: Mail, label: "Email delivery", required: true },
  messaging: { icon: MessageSquare, label: "Messaging", required: false },
};

function OnboardingCompletePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkspaceIntegrations);
  const catalogFn = useServerFn(listProviderCatalog);
  const activateFn = useServerFn(activateWorkspace);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["onboarding-complete-workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, status, recovery_engine_enabled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: integrations = [] } = useQuery({
    enabled: !!workspace?.id,
    queryKey: ["onboarding-complete-integrations", workspace?.id],
    queryFn: () => listFn({ data: { workspaceId: workspace!.id } }),
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["onboarding-complete-catalog"],
    queryFn: () => catalogFn({}),
  });

  const groups = useMemo(() => {
    const kindByProvider = new Map<string, ProviderKind>();
    for (const p of catalog) kindByProvider.set(p.provider, p.kind as ProviderKind);
    return PROVIDER_STEP_ORDER.map((step) => {
      const items = integrations
        .filter((i) => kindByProvider.get(i.provider) === step.kind)
        .map((i) => ({
          id: i.id,
          provider: i.provider,
          status: i.status,
          verified:
            (i.verification_status === "verified" || i.last_test_ok === true) &&
            i.status === "connected",
        }));
      const connected = items.some((i) => i.verified);
      return { kind: step.kind, title: step.title, items, connected };
    });
  }, [catalog, integrations]);

  const requiredMissing = groups.filter((g) => KIND_META[g.kind].required && !g.connected);
  const allReady = requiredMissing.length === 0;
  const engineActive = !!workspace?.recovery_engine_enabled;

  const activate = useMutation({
    mutationFn: async () => {
      if (!workspace?.id) throw new Error("No workspace found.");
      return activateFn({ data: { workspaceId: workspace.id } });
    },
    onSuccess: async () => {
      toast.success("Recovery Engine activated");
      await qc.invalidateQueries({ queryKey: ["onboarding-complete-workspace"] });
      navigate({ to: "/app" });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    },
  });

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/getting-started" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to setup
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Onboarding complete</span>
        </div>
        <h1 className="mt-3 flex items-center gap-3 text-3xl font-semibold text-foreground">
          <PartyPopper className="h-7 w-7 text-primary" />
          {workspace?.name ?? "Your workspace"} is ready
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {allReady
            ? "Every required integration is verified. Review what's connected and activate the Recovery Engine to start capturing failed payments."
            : "You still have required steps outstanding. Finish those first, then return here to activate."}
        </p>

        {/* Hero activation card */}
        <div
          className={cn(
            "mt-8 rounded-2xl border p-6",
            engineActive
              ? "border-emerald-500/40 bg-emerald-500/5"
              : allReady
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 bg-card/40",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {engineActive ? (
                <ShieldCheck className="mt-0.5 h-8 w-8 text-emerald-500" />
              ) : allReady ? (
                <Rocket className="mt-0.5 h-8 w-8 text-primary" />
              ) : (
                <AlertCircle className="mt-0.5 h-8 w-8 text-amber-500" />
              )}
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {engineActive
                    ? "Recovery Engine is live"
                    : allReady
                      ? "Ready to activate"
                      : `${requiredMissing.length} required step${requiredMissing.length === 1 ? "" : "s"} remaining`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {engineActive
                    ? "New failed payments will be captured and recovered automatically."
                    : allReady
                      ? "Activation runs a final verification check before turning the engine on."
                      : `Missing: ${requiredMissing.map((g) => KIND_META[g.kind].label).join(", ")}.`}
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {engineActive ? (
                <Button onClick={() => navigate({ to: "/app" })}>
                  Go to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : allReady ? (
                <Button onClick={() => activate.mutate()} disabled={activate.isPending}>
                  {activate.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-4 w-4" />
                  )}
                  Activate Recovery Engine
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate({ to: "/getting-started" })}>
                  Finish setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Connected summary */}
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            What's connected
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {groups.map((g) => {
              const meta = KIND_META[g.kind];
              const Icon = meta.icon;
              return (
                <div
                  key={g.kind}
                  className={cn(
                    "rounded-2xl border p-4",
                    g.connected
                      ? "border-primary/30 bg-primary/5"
                      : meta.required
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/60 bg-card/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{meta.label}</span>
                      {!meta.required && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </div>
                    {g.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : meta.required ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Skipped
                      </span>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {g.items.length === 0 ? (
                      <li className="text-xs text-muted-foreground">
                        {meta.required ? "Not connected yet." : "No provider connected."}
                      </li>
                    ) : (
                      g.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between">
                          <span className="capitalize text-foreground">{it.provider}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                              it.verified
                                ? "bg-emerald-500/10 text-emerald-500"
                                : it.status === "connected"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {it.verified
                              ? "Verified"
                              : it.status === "connected"
                                ? "Needs verify"
                                : it.status}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Next steps */}
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            What happens next
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                We start listening to your store and payment gateway webhooks in real time.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                Failed payments trigger recovery flows across email
                {groups.find((g) => g.kind === "messaging")?.connected ? " and messaging" : ""}.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                Track recovered revenue and events on the{" "}
                <Link to="/analytics" className="underline hover:text-foreground">
                  Analytics
                </Link>{" "}
                and{" "}
                <Link to="/events" className="underline hover:text-foreground">
                  Events
                </Link>{" "}
                pages.
              </span>
            </li>
          </ul>
        </section>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Need to change something?{" "}
          <Link to="/integrations" className="underline hover:text-foreground">
            Manage integrations
          </Link>
        </div>
      </main>
    </div>
  );
}
