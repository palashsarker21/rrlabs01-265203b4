import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { Suspense } from "react";

import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { listPublicPlans } from "@/lib/billing.functions";

const plansQuery = queryOptions({
  queryKey: ["public-plans"],
  queryFn: () => listPublicPlans(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/pricing")({
  loader: ({ context }) => context.queryClient.ensureQueryData(plansQuery),
  head: () => ({
    meta: [
      { title: "Pricing — RRLabs" },
      {
        name: "description",
        content:
          "Simple, usage-based pricing for RRLabs. Start with a 14-day trial and only pay when you recover revenue.",
      },
      { property: "og:title", content: "RRLabs Pricing" },
      {
        property: "og:description",
        content: "Choose the recovery volume that fits your business. 14-day free trial.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-lg p-8 text-center text-sm text-destructive">
      Could not load pricing: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Pricing not found.</div>,
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/">
            <BrandLockup />
          </Link>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button size="sm" variant="ghost">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Pricing that scales with recovered revenue
          </h1>
          <p className="mt-4 text-muted-foreground">
            Every plan starts with a 14-day free trial. Cancel anytime — no lock-in.
          </p>
        </div>

        <Suspense fallback={<PlansSkeleton />}>
          <PlanGrid />
        </Suspense>
      </main>
    </div>
  );
}

function PlanGrid() {
  const { data: plans } = useSuspenseQuery(plansQuery);

  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {plans.map((p, i) => {
        const features = Array.isArray(p.features) ? (p.features as string[]) : [];
        const highlight = i === 1;
        return (
          <div
            key={p.id}
            className={
              "rounded-2xl border p-6 " +
              (highlight
                ? "border-primary/60 bg-card/80 shadow-lg shadow-primary/10"
                : "border-border/60 bg-card/50")
            }
          >
            {highlight && (
              <div className="mb-3 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Most popular
              </div>
            )}
            <h3 className="text-xl font-semibold text-foreground">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">
                ${(p.price_cents / 100).toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">/ {p.interval}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.trial_days}-day free trial · {p.currency}
            </p>

            <ul className="mt-6 space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/auth"
              search={{ redirect: `/checkout?plan=${p.id}` }}
              className="mt-8 block"
            >
              <Button className="w-full" variant={highlight ? "default" : "outline"}>
                Start {p.trial_days}-day trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-96 animate-pulse rounded-2xl border border-border/60 bg-card/40" />
      ))}
    </div>
  );
}
