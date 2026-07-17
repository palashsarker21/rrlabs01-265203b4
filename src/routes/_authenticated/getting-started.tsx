import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
  Store,
  CreditCard,
  Mail,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { cn } from "@/lib/utils";
import { listWorkspaceIntegrations } from "@/lib/integrations.functions";
import { listProviderCatalog } from "@/lib/providers.functions";
import { PROVIDER_STEP_ORDER, type ProviderKind } from "@/lib/providers/kinds";

export const Route = createFileRoute("/_authenticated/getting-started")({
  head: () => ({
    meta: [
      { title: "Getting Started — RRLabs" },
      { name: "description", content: "Guided setup for your RRLabs workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GettingStartedPage,
});

const STEP_META: Record<
  ProviderKind,
  { icon: typeof Store; required: boolean; helper: string }
> = {
  store: {
    icon: Store,
    required: true,
    helper: "Shopify, WooCommerce, or another storefront so we know which carts to recover.",
  },
  gateway: {
    icon: CreditCard,
    required: true,
    helper: "Stripe, PayPal, or another processor so we hear failed payments in real time.",
  },
  email: {
    icon: Mail,
    required: true,
    helper: "Postmark, Resend, or SES to deliver your recovery emails.",
  },
  messaging: {
    icon: MessageSquare,
    required: false,
    helper: "Twilio or WhatsApp — optional, but boosts recovery rate for high-value carts.",
  },
};

function GettingStartedPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listWorkspaceIntegrations);
  const statusesFn = useServerFn(listWorkspaceProviderStatuses);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["getting-started-workspace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, status, recovery_engine_enabled, setup_step")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: integrations = [] } = useQuery({
    enabled: !!workspace?.id,
    queryKey: ["getting-started-integrations", workspace?.id],
    queryFn: () => listFn({ data: { workspaceId: workspace!.id } }),
  });

  const { data: statuses = [] } = useQuery({
    enabled: !!workspace?.id,
    queryKey: ["getting-started-statuses", workspace?.id],
    queryFn: () => statusesFn({ data: { workspaceId: workspace!.id } }),
  });

  const stepState = useMemo(() => {
    return PROVIDER_STEP_ORDER.map((step) => {
      const integrationKind = integrationKindFor(step.kind);
      // For email vs messaging, both map to "communication" — disambiguate by provider status.
      const kindStatuses = statuses.filter((s) => s.kind === step.kind);
      const connected = kindStatuses.some(
        (s) => s.status === "connected" || s.status === "healthy",
      );
      const anyIntegration =
        step.kind === "email" || step.kind === "messaging"
          ? kindStatuses.length > 0
          : integrations.some((i) => i.kind === integrationKind);
      return {
        ...step,
        meta: STEP_META[step.kind],
        connected,
        started: anyIntegration && !connected,
      };
    });
  }, [statuses, integrations]);

  const requiredSteps = stepState.filter((s) => s.meta.required);
  const requiredConnected = requiredSteps.filter((s) => s.connected).length;
  const progress = requiredSteps.length
    ? Math.round((requiredConnected / requiredSteps.length) * 100)
    : 0;
  const allRequiredDone = requiredConnected === requiredSteps.length;
  const engineActive = !!workspace?.recovery_engine_enabled;

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
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Guided setup</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">
          Let's get {workspace?.name ?? "your workspace"} ready
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect your store, payment gateway, and delivery channels. When the required steps are
          done, you can activate the Recovery Engine.
        </p>

        {/* Progress card */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Setup progress
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {requiredConnected} of {requiredSteps.length} required steps
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-foreground">{progress}%</div>
              <div className="text-xs text-muted-foreground">complete</div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <ol className="mt-8 space-y-4">
          {stepState.map((step, idx) => {
            const Icon = step.meta.icon;
            const state = step.connected ? "done" : step.started ? "progress" : "todo";
            return (
              <li
                key={step.kind}
                className={cn(
                  "rounded-2xl border p-5 transition-colors",
                  state === "done"
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 bg-card/40",
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      state === "done"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Step {idx + 1}
                      </span>
                      {step.meta.required ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                          Required
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Optional
                        </span>
                      )}
                      {state === "progress" && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-500">
                          Needs attention
                        </span>
                      )}
                      {state === "done" && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-500">
                          Connected
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.meta.helper}</p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      variant={state === "done" ? "outline" : "default"}
                      onClick={() =>
                        navigate({ to: "/integrations", hash: `step-${step.kind}` })
                      }
                    >
                      {state === "done" ? "Manage" : state === "progress" ? "Continue" : "Set up"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Readiness checklist */}
        <section className="mt-10 rounded-2xl border border-border/60 bg-card/50 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Readiness checklist</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every required item must be green before you can activate the Recovery Engine.
          </p>

          <ul className="mt-5 space-y-3">
            {stepState.map((step) => (
              <li key={`check-${step.kind}`} className="flex items-start gap-3">
                {step.connected ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : step.meta.required ? (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {step.title}
                    {!step.meta.required && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {step.connected
                      ? "Connected and verified."
                      : step.started
                        ? "Started — finish credentials to verify."
                        : "Not started."}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              {engineActive ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-500">Recovery Engine is active.</span>
                </>
              ) : allRequiredDone ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-foreground">You're ready to activate.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">
                    Finish the required steps to unlock activation.
                  </span>
                </>
              )}
            </div>
            <Button
              disabled={!allRequiredDone && !engineActive}
              onClick={() => navigate({ to: "/integrations" })}
            >
              {engineActive ? "View integrations" : "Go to activation"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Need help? <Link to="/app" className="underline hover:text-foreground">Back to dashboard</Link>
        </div>
      </main>
    </div>
  );
}
