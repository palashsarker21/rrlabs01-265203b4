import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  reason: z.enum(["trial_expired", "feature_locked", "manual"]).optional(),
  feature: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/upgrade")({
  validateSearch: (raw) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Upgrade your plan — RRLabs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UpgradePage,
});

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function UpgradePage() {
  const { reason, feature } = useSearch({ from: "/_authenticated/upgrade" });

  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, code, name, description, price_cents, currency, interval, features, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const heading =
    reason === "trial_expired"
      ? "Your free trial has ended"
      : reason === "feature_locked"
        ? "Upgrade required"
        : "Choose your plan";
  const sub =
    reason === "trial_expired"
      ? "Continue recovering failed payments by upgrading your subscription."
      : reason === "feature_locked"
        ? `Unlock ${feature ? feature.replace(/_/g, " ") : "this feature"} by upgrading your subscription.`
        : "Pick the plan that fits your business. Upgrade or downgrade any time.";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Button asChild size="sm" variant="ghost">
            <Link to="/app">Back to dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            {reason === "trial_expired" ? "Trial expired" : "Upgrade"}
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">{heading}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{sub}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((plan, i) => {
            const featured = i === 1;
            const features = Array.isArray(plan.features)
              ? (plan.features as unknown[]).filter((f): f is string => typeof f === "string")
              : [];
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border p-6",
                  featured
                    ? "border-primary/60 bg-primary/[0.03] shadow-md"
                    : "border-border/60 bg-card/40",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  {featured ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                      Popular
                    </span>
                  ) : null}
                </div>
                {plan.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                ) : null}
                <div className="mt-4">
                  <span className="text-3xl font-semibold text-foreground">
                    {money(plan.price_cents ?? 0, plan.currency ?? "USD")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    /{plan.interval ?? "month"}
                  </span>
                </div>

                {features.length > 0 ? (
                  <ul className="mt-5 space-y-2 text-sm">
                    {features.slice(0, 6).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-foreground/90">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-6">
                  <Button asChild className="w-full" variant={featured ? "default" : "outline"}>
                    <Link to="/checkout" search={{ plan: plan.id }}>
                      Upgrade to {plan.name}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="ghost">
            <Link to="/app">Return to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/pricing">See full pricing page</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
