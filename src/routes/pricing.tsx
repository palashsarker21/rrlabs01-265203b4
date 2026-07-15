import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  BadgeCheck,
  CreditCard,
  ChevronDown,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SITE_URL } from "@/lib/brand";
import { PLANS, COMPARE_ROWS, PRICING_FAQ, TRIAL_DAYS, type PricingPlan } from "@/lib/pricing";
import { listPublicPlans } from "@/lib/billing.functions";
import { CtaButton } from "@/components/pricing/cta-button";
import { useIsAuthed } from "@/hooks/use-is-authed";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Enterprise plans that grow with your revenue | RRLabs" },
      {
        name: "description",
        content: `Enterprise pricing for AI-powered revenue recovery. Starter $29, Growth $99, Business $299. ${TRIAL_DAYS}-day free trial. No credit card required.`,
      },
      { property: "og:title", content: "RRLabs Pricing" },
      {
        property: "og:description",
        content: `Enterprise pricing that grows with your revenue. ${TRIAL_DAYS}-day free trial. No credit card required.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  }),
  component: PricingPage,
});

const TRUST = [
  { icon: Sparkles, label: `${TRIAL_DAYS}-Day Free Trial` },
  { icon: CreditCard, label: "No Credit Card Required" },
  { icon: BadgeCheck, label: "AI Powered" },
  { icon: ShieldCheck, label: "Enterprise Ready" },
];

type ServerPlan = Awaited<ReturnType<typeof listPublicPlans>>[number];

function PricingPage() {
  const authed = useIsAuthed();
  const { data: serverPlans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => listPublicPlans(),
    staleTime: 60_000,
  });

  const byCode = useMemo(() => {
    const m = new Map<string, ServerPlan>();
    (serverPlans ?? []).forEach((p) => m.set(p.code, p));
    return m;
  }, [serverPlans]);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <MarketingHeader />
      <Hero />
      <PlanGrid isAuthenticated={!!authed} byCode={byCode} />
      <ComparisonTable />
      <ROICalculator isAuthenticated={!!authed} byCode={byCode} />
      <FAQ />
      <FinalCTA />
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#fafafa]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.06),transparent_70%)]" />
      <div className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Simple, transparent pricing
        </div>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl md:text-6xl">
          Enterprise pricing that grows with your revenue.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
          Recover failed payments automatically with AI-powered Email and WhatsApp recovery. Start
          free with a {TRIAL_DAYS}-day trial. Upgrade only when you're ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" search={{ redirect: "/checkout" }}>
            <Button
              size="lg"
              className="rounded-full bg-emerald-600 px-6 text-white hover:bg-emerald-700"
            >
              Start Free Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact-sales">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-neutral-300 bg-white px-6 text-neutral-900 hover:bg-neutral-100"
            >
              Talk to Sales
            </Button>
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600"
            >
              <Icon className="h-3.5 w-3.5 text-emerald-600" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanGrid({
  isAuthenticated,
  byCode,
}: {
  isAuthenticated: boolean;
  byCode: Map<string, ServerPlan>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard
            key={p.code}
            plan={p}
            isAuthenticated={isAuthenticated}
            server={byCode.get(p.code)}
          />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-500">
        {TRIAL_DAYS}-day free trial on all plans. No credit card required. Cancel anytime.
      </p>
    </section>
  );
}

function PlanCard({
  plan,
  isAuthenticated,
  server,
}: {
  plan: PricingPlan;
  isAuthenticated: boolean;
  server?: ServerPlan;
}) {
  const highlight = !!plan.highlight;
  const enterprise = !!plan.enterprise;
  const hasCheckoutVariant = server?.has_variant ?? plan.cta.kind !== "trial" ? true : !!server?.has_variant;
  return (
    <div
      className={
        "group relative flex h-full flex-col rounded-2xl border bg-white p-6 transition-all duration-300 " +
        (highlight
          ? "border-emerald-500/70 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/10"
          : "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.18)]")
      }
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most Popular
        </div>
      )}
      {enterprise && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Enterprise
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-neutral-950">{plan.name}</h3>
        <p className="mt-1 text-sm text-neutral-600">{plan.tagline}</p>
      </div>

      <div className="mt-6 min-h-[92px]">
        {plan.priceLead && <p className="text-xs text-neutral-500">{plan.priceLead}</p>}
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-neutral-950">
            {plan.price}
          </span>
          {plan.priceSuffix && <span className="text-sm text-neutral-500">{plan.priceSuffix}</span>}
        </div>
        <p className="mt-1 text-xs font-medium text-emerald-700">{plan.successFee}</p>
      </div>

      <div className="my-6 h-px bg-neutral-200" />

      <div className="flex-1">
        {plan.featuresLead && (
          <p className="mb-3 text-xs font-medium text-neutral-500">{plan.featuresLead}</p>
        )}
        <ul className="space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-800">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <CtaButton
          plan={plan}
          isAuthenticated={isAuthenticated}
          hasCheckoutVariant={hasCheckoutVariant}
          planIdForCheckout={server?.id ?? null}
          variant={highlight ? "primary" : "outline"}
          fullWidth
        />
      </div>
    </div>
  );
}

function ComparisonTable() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Compare plans
        </h2>
        <p className="mt-3 text-neutral-600">
          Every plan includes the AI recovery engine. Higher tiers unlock deeper analytics,
          automation, and enterprise controls.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">RRLabs plan feature comparison</caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70">
                <th scope="col" className="p-4 text-left font-medium text-neutral-500">
                  Feature
                </th>
                {PLANS.map((p) => (
                  <th
                    scope="col"
                    key={p.code}
                    className="p-4 text-center font-semibold text-neutral-950"
                  >
                    {p.name}
                    {p.highlight && (
                      <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 align-middle text-[9px] font-medium uppercase tracking-wider text-white">
                        Popular
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 === 1 ? "bg-neutral-50/40" : ""}>
                  <th scope="row" className="p-4 text-left font-normal text-neutral-800">
                    {row.label}
                  </th>
                  {row.values.map((v, idx) => (
                    <td key={idx} className="p-4 text-center">
                      {typeof v === "boolean" ? (
                        v ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <span
                            className="mx-auto block h-1 w-4 rounded-full bg-neutral-200"
                            aria-label="Not included"
                          />
                        )
                      ) : (
                        <span className="text-xs font-medium text-neutral-700">{v}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ROICalculator({
  isAuthenticated,
  byCode,
}: {
  isAuthenticated: boolean;
  byCode: Map<string, ServerPlan>;
}) {
  const [failedPayments, setFailedPayments] = useState(200);
  const [aov, setAov] = useState(49);
  const [recoveryRate, setRecoveryRate] = useState(35);

  const growth = PLANS.find((p) => p.code === "growth")!;

  const results = useMemo(() => {
    const failedRevenue = failedPayments * aov;
    const recovered = failedRevenue * (recoveryRate / 100);
    const successFee = recovered * (growth.successFeeBps / 10000);
    const platformCost = (growth.monthlyBaseCents ?? 9900) / 100 + successFee;
    const netGain = recovered - platformCost;
    const annualGain = netGain * 12;
    const roi = platformCost > 0 ? (netGain / platformCost) * 100 : 0;
    return { recovered, successFee, platformCost, netGain, annualGain, roi };
  }, [failedPayments, aov, recoveryRate, growth.successFeeBps, growth.monthlyBaseCents]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              See what RRLabs could recover
            </h2>
            <p className="mt-3 text-neutral-600">
              Estimate your recovered revenue and ROI. Numbers update instantly.
            </p>
            <div className="mt-8 space-y-6">
              <NumberField
                label="Monthly failed payments"
                value={failedPayments}
                min={0}
                max={20000}
                step={10}
                onChange={setFailedPayments}
              />
              <NumberField
                label="Average order value"
                prefix="$"
                value={aov}
                min={1}
                max={5000}
                step={1}
                onChange={setAov}
              />
              <NumberField
                label="Expected recovery rate"
                suffix="%"
                value={recoveryRate}
                min={0}
                max={80}
                step={1}
                onChange={setRecoveryRate}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-[#fafafa] p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Estimated results
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <Result label="Recovered Revenue" value={fmt(results.recovered)} />
              <Result label="Platform Fee" value={fmt(results.platformCost)} />
              <Result label="Net Revenue" value={fmt(results.netGain)} accent />
              <Result label="Annual Net Gain" value={fmt(results.annualGain)} accent />
              <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-800">
                  Estimated ROI
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-emerald-700">
                  {Number.isFinite(results.roi) ? `${results.roi.toFixed(0)}%` : "—"}
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs text-neutral-500">
              Based on the Growth plan ({growth.price}
              {growth.priceSuffix} · {growth.successFee}). Estimates vary by industry and payment
              mix.
            </p>
            <div className="mt-6">
              <CtaButton
                plan={growth}
                isAuthenticated={isAuthenticated}
                hasCheckoutVariant={byCode.get("growth")?.has_variant ?? false}
                planIdForCheckout={byCode.get("growth")?.id ?? null}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-800">{label}</label>
        <div className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm font-medium text-neutral-900">
          {prefix}
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
            }}
            className="w-24 bg-transparent text-right outline-none"
            aria-label={label}
          />
          {suffix}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-600"
        aria-label={`${label} slider`}
      />
    </div>
  );
}

function Result({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p
        className={
          "mt-1 text-2xl font-semibold tracking-tight " +
          (accent ? "text-emerald-700" : "text-neutral-950")
        }
      >
        {value}
      </p>
    </div>
  );
}

function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Frequently asked questions
        </h2>
      </div>
      <div className="mt-10 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {PRICING_FAQ.map((item, i) => (
          <FAQItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}

function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-sm font-medium text-neutral-900 sm:text-base">{q}</span>
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-neutral-500 transition-transform " + (open ? "rotate-180" : "")
          }
        />
      </button>
      {open && <div className="px-6 pb-5 text-sm leading-relaxed text-neutral-600">{a}</div>}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-[#fafafa] p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.08),transparent_70%)]" />
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
          Stop losing revenue to failed payments.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-600">
          Start free in minutes. Upgrade only when you're ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" search={{ redirect: "/checkout" }}>
            <Button
              size="lg"
              className="rounded-full bg-emerald-600 px-6 text-white hover:bg-emerald-700"
            >
              Start Free Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact-sales">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-neutral-300 bg-white px-6 text-neutral-900 hover:bg-neutral-100"
            >
              Talk to Sales
            </Button>
          </Link>
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 text-xs text-neutral-500">
          <Lock className="h-3.5 w-3.5" />
          Secure checkout · Powered by Lemon Squeezy
        </div>
      </div>
    </section>
  );
}

function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <Link to="/contact-sales" className="flex-1">
          <Button
            variant="outline"
            className="w-full rounded-full border-neutral-300 bg-white text-neutral-900"
          >
            Talk to Sales
          </Button>
        </Link>
        <Link to="/auth" search={{ redirect: "/checkout" }} className="flex-1">
          <Button className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
            Start Free Trial
          </Button>
        </Link>
      </div>
    </div>
  );
}
