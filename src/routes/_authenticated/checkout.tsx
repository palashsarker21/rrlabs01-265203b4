import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/brand-mark";
import { createCheckoutSession } from "@/lib/billing.functions";

const searchSchema = z.object({
  plan: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [{ title: "Start your subscription — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { plan: planParam } = useSearch({ from: "/_authenticated/checkout" });
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(planParam);
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("Default");
  const [submitting, setSubmitting] = useState(false);

  const startCheckout = useServerFn(createCheckoutSession);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, code, name, description, price_cents, currency, interval, trial_days")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlanId || !orgName.trim() || !wsName.trim()) {
      toast.error("Please fill in every field.");
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await startCheckout({
        data: {
          planId: selectedPlanId,
          organizationName: orgName.trim(),
          workspaceName: wsName.trim(),
        },
      });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start checkout.";
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app" })}>
            Cancel
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a plan and name your company. We'll create your workspace after payment confirms.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          <div>
            <Label className="text-sm text-muted-foreground">Plan</Label>
            {isLoading ? (
              <div className="mt-2 h-24 animate-pulse rounded-lg border border-border/60 bg-card/40" />
            ) : (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {plans?.map((p) => {
                  const active = selectedPlanId === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={
                        "rounded-xl border p-4 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-card/40 hover:bg-card/60")
                      }
                    >
                      <div className="text-sm font-semibold text-foreground">{p.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        ${(p.price_cents / 100).toFixed(0)}/{p.interval} · {p.trial_days}d trial
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="org">Company / organization name</Label>
            <Input
              id="org"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Inc."
              autoComplete="organization"
              required
              maxLength={80}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="ws">Workspace name</Label>
            <Input
              id="ws"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="Default"
              required
              maxLength={80}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              You can rename this any time. Multiple workspaces per organization coming soon.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting || !selectedPlanId}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to secure checkout…
              </>
            ) : (
              <>
                Continue to secure checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Payments processed by Lemon Squeezy. Cancel any time from your dashboard.
          </p>
        </form>
      </main>
    </div>
  );
}
