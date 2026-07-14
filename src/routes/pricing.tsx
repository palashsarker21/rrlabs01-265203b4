import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight, Check, Sparkles, ShieldCheck, Lock, BadgeCheck, ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SITE_URL } from "@/lib/brand";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Simple plans that grow with you | RRLabs" },
      {
        name: "description",
        content:
          "Simple pricing for AI-powered revenue recovery. Fixed monthly subscription plus a small success fee only when revenue is recovered.",
      },
      { property: "og:title", content: "RRLabs Pricing" },
      {
        property: "og:description",
        content: "Fixed monthly plans plus a small success fee. Pay only when we recover revenue.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/pricing` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  }),
  component: PricingPage,
});

type Plan = {
  code: "starter" | "growth" | "business" | "enterprise";
  name: string;
  price: string;
  priceSuffix: string;
  fee: string;
  tagline: string;
  featuresLead?: string;
  features: string[];
  cta: string;
  ctaTo: string;
  ctaSearch?: Record<string, string>;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    code: "starter",
    name: "Starter",
    price: "$29",
    priceSuffix: "/month",
    fee: "+ 5% success fee",
    tagline: "Best for startups and small businesses.",
    features: [
      "AI Recovery Engine",
      "Email Recovery",
      "WhatsApp Recovery",
      "Stripe Integration",
      "Shopify Integration",
      "WooCommerce Integration",
      "Basic Analytics",
      "Community Support",
    ],
    cta: "Start Starter",
    ctaTo: "/auth",
    ctaSearch: { redirect: "/checkout?plan=starter" },
  },
  {
    code: "growth",
    name: "Growth",
    price: "$99",
    priceSuffix: "/month",
    fee: "+ 4% success fee",
    tagline: "Perfect for growing subscription businesses.",
    featuresLead: "Everything in Starter, plus:",
    features: [
      "Advanced Analytics",
      "Customer Insights",
      "AI Recommendations",
      "Workflow Automation",
      "Unlimited Integrations",
      "Priority Support",
    ],
    cta: "Start Growth",
    ctaTo: "/auth",
    ctaSearch: { redirect: "/checkout?plan=growth" },
    highlight: true,
  },
  {
    code: "business",
    name: "Business",
    price: "$299",
    priceSuffix: "/month",
    fee: "+ 3% success fee",
    tagline: "Built for high-volume SaaS companies.",
    featuresLead: "Everything in Growth, plus:",
    features: [
      "Executive Dashboard",
      "Realtime Analytics",
      "Revenue Intelligence",
      "Advanced Security",
      "Team Management",
      "Premium Support",
    ],
    cta: "Start Business",
    ctaTo: "/auth",
    ctaSearch: { redirect: "/checkout?plan=business" },
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "From $999",
    priceSuffix: "/month",
    fee: "Custom success fee",
    tagline: "For enterprise organizations with advanced requirements.",
    featuresLead: "Everything in Business, plus:",
    features: [
      "White Label",
      "Custom Branding",
      "Dedicated Infrastructure",
      "Enterprise Security",
      "Dedicated Success Manager",
      "Custom Integrations",
    ],
    cta: "Contact Sales",
    ctaTo: "/contact",
  },
];

const TRUST = [
  { icon: Sparkles, label: "AI Powered" },
  { icon: BadgeCheck, label: "Enterprise Ready" },
  { icon: ShieldCheck, label: "Secure by Design" },
  { icon: Lock, label: "No Hidden Fees" },
];

const COMPARE_ROWS: { label: string; values: [boolean, boolean, boolean, boolean] }[] = [
  { label: "AI Recovery Engine",  values: [true, true, true, true] },
  { label: "Email Recovery",      values: [true, true, true, true] },
  { label: "WhatsApp Recovery",   values: [true, true, true, true] },
  { label: "Analytics",           values: [true, true, true, true] },
  { label: "Advanced Analytics",  values: [false, true, true, true] },
  { label: "Realtime Dashboard",  values: [false, false, true, true] },
  { label: "AI Recommendations",  values: [false, true, true, true] },
  { label: "Workflow Automation", values: [false, true, true, true] },
  { label: "White Label",         values: [false, false, false, true] },
  { label: "Custom Integrations", values: [false, false, false, true] },
  { label: "Priority Support",    values: [false, true, true, true] },
  { label: "Dedicated Support",   values: [false, false, false, true] },
];

const FAQS = [
  {
    q: "What is the success fee?",
    a: "A small percentage of revenue we successfully recover for you. If we don't recover, you don't pay a success fee — only the fixed monthly subscription.",
  },
  {
    q: "How does AI recovery work?",
    a: "Our engine analyzes each failed payment, chooses the best retry timing, and sends AI-generated Email and WhatsApp messages tailored to the customer, language, and payment failure reason.",
  },
  {
    q: "Do I use my own Email and WhatsApp accounts?",
    a: "Yes. You connect your existing Email (SMTP / provider) and WhatsApp Business API accounts. RRLabs orchestrates messaging on your behalf — your brand, your deliverability.",
  },
  {
    q: "Can I upgrade anytime?",
    a: "Yes. Upgrade, downgrade, or cancel at any time from your dashboard. Changes are prorated automatically.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit and at rest. We follow enterprise security practices with role-based access, audit logs, and least-privilege service boundaries.",
  },
  {
    q: "Do you offer Enterprise onboarding?",
    a: "Yes. Enterprise plans include a dedicated success manager, custom integration support, and white-glove onboarding tailored to your stack.",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900">
      <MarketingHeader />
      <Hero />
      <PlanGrid />
      <ComparisonTable />
      <ROICalculator />
      <FAQ />
      <FinalCTA />
      <StickyMobileCTA />
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.05),transparent_70%)]" />
      <div className="mx-auto max-w-4xl px-6 pt-20 pb-14 text-center sm:pt-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered revenue recovery
        </div>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl md:text-6xl">
          Simple pricing that grows with your business.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
          Recover failed subscription payments automatically using AI-powered Email and WhatsApp
          recovery. Pay a fixed monthly subscription plus a small success fee — only when revenue
          is recovered.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" search={{ redirect: "/setup" }}>
            <Button size="lg" className="rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800">
              Start Free Setup
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="outline" className="rounded-full border-neutral-300 bg-white px-6 text-neutral-900 hover:bg-neutral-100">
              Talk to Sales
            </Button>
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <Icon className="h-3.5 w-3.5 text-neutral-500" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard key={p.code} plan={p} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-500">
        All plans include a 14-day free trial. No credit card required to start.
      </p>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const highlight = !!plan.highlight;
  return (
    <div
      className={
        "group relative flex h-full flex-col rounded-2xl border bg-white p-6 transition-all duration-300 " +
        (highlight
          ? "border-neutral-900 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] ring-1 ring-neutral-900/5"
          : "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.18)]")
      }
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most Popular
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold text-neutral-950">{plan.name}</h3>
        <p className="mt-1 text-sm text-neutral-600">{plan.tagline}</p>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-neutral-950">{plan.price}</span>
          <span className="text-sm text-neutral-500">{plan.priceSuffix}</span>
        </div>
        <p className="mt-1 text-xs font-medium text-neutral-600">{plan.fee}</p>
      </div>

      <div className="my-6 h-px bg-neutral-200" />

      <div className="flex-1">
        {plan.featuresLead && (
          <p className="mb-3 text-xs font-medium text-neutral-500">{plan.featuresLead}</p>
        )}
        <ul className="space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-800">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Link
          to={plan.ctaTo}
          {...(plan.ctaSearch ? { search: plan.ctaSearch } : {})}
          className="block"
        >
          <Button
            className={
              "w-full rounded-full transition-colors " +
              (highlight
                ? "bg-neutral-950 text-white hover:bg-neutral-800"
                : "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100")
            }
          >
            {plan.cta}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ComparisonTable() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Compare plans at a glance
        </h2>
        <p className="mt-3 text-neutral-600">
          Every plan includes the AI recovery engine. Higher tiers unlock deeper analytics,
          automation, and enterprise controls.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70">
                <th className="p-4 text-left font-medium text-neutral-500">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.code} className="p-4 text-center font-semibold text-neutral-950">
                    {p.name}
                    {p.highlight && (
                      <span className="ml-1.5 rounded-full bg-neutral-950 px-1.5 py-0.5 align-middle text-[9px] font-medium uppercase tracking-wider text-white">
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
                  <td className="p-4 text-neutral-800">{row.label}</td>
                  {row.values.map((v, idx) => (
                    <td key={idx} className="p-4 text-center">
                      {v ? (
                        <Check className="mx-auto h-4 w-4 text-neutral-900" />
                      ) : (
                        <span className="mx-auto block h-1 w-4 rounded-full bg-neutral-200" aria-label="Not included" />
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

function ROICalculator() {
  const [revenue, setRevenue] = useState(50000);
  const [failedPct, setFailedPct] = useState(8);
  const [aov, setAov] = useState(49);
  const [recoveryRate, setRecoveryRate] = useState(35);

  const { recovered, monthlyProfit, roi } = useMemo(() => {
    const failedRevenue = revenue * (failedPct / 100);
    const recovered = failedRevenue * (recoveryRate / 100);
    // Assume Growth plan cost as reference: $99 + 4% success fee
    const platformCost = 99 + recovered * 0.04;
    const monthlyProfit = recovered - platformCost;
    const roi = platformCost > 0 ? (monthlyProfit / platformCost) * 100 : 0;
    return { recovered, monthlyProfit, roi };
  }, [revenue, failedPct, recoveryRate]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              See what RRLabs could recover
            </h2>
            <p className="mt-3 text-neutral-600">
              Estimate your monthly recovered revenue and ROI. Numbers update instantly.
            </p>
            <div className="mt-8 space-y-6">
              <NumberField
                label="Monthly Revenue"
                prefix="$"
                value={revenue}
                min={1000}
                max={2000000}
                step={1000}
                onChange={setRevenue}
              />
              <NumberField
                label="Failed Payments"
                suffix="%"
                value={failedPct}
                min={0}
                max={30}
                step={0.5}
                onChange={setFailedPct}
              />
              <NumberField
                label="Average Order Value"
                prefix="$"
                value={aov}
                min={1}
                max={5000}
                step={1}
                onChange={setAov}
              />
              <NumberField
                label="Expected Recovery Rate"
                suffix="%"
                value={recoveryRate}
                min={0}
                max={80}
                step={1}
                onChange={setRecoveryRate}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-950 p-8 text-white">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
              Estimated results
            </p>
            <div className="mt-6 space-y-6">
              <Result label="Estimated Revenue Recovered" value={fmt(recovered)} />
              <Result label="Monthly Profit Increase" value={fmt(monthlyProfit)} tone="pos" />
              <Result label="Estimated ROI" value={`${roi.toFixed(0)}%`} tone="pos" />
            </div>
            <p className="mt-8 text-xs text-neutral-400">
              Based on the Growth plan ($99/mo + 4% success fee). Estimates are illustrative and
              vary by industry, payment mix, and customer base.
            </p>
            <Link to="/auth" search={{ redirect: "/setup" }} className="mt-6 inline-block">
              <Button className="rounded-full bg-white text-neutral-950 hover:bg-neutral-200">
                Start Free Setup
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function NumberField({
  label, value, min, max, step, onChange, prefix, suffix,
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
        className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
        aria-label={`${label} slider`}
      />
    </div>
  );
}

function Result({ label, value, tone }: { label: string; value: string; tone?: "pos" }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={"mt-1 text-3xl font-semibold tracking-tight " + (tone === "pos" ? "text-emerald-400" : "text-white")}>
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
        <p className="mt-3 text-neutral-600">
          Everything you need to know before getting started.
        </p>
      </div>
      <div className="mt-10 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {FAQS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} defaultOpen={i === 0} />
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
          className={"h-4 w-4 shrink-0 text-neutral-500 transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm leading-relaxed text-neutral-600">{a}</div>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(0,0,0,0.06),transparent_70%)]" />
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
          Stop losing revenue to failed payments.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-neutral-600">
          Get started in minutes and let RRLabs recover revenue automatically while you focus on
          growing your business.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" search={{ redirect: "/setup" }}>
            <Button size="lg" className="rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800">
              Start Free Setup
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="outline" className="rounded-full border-neutral-300 bg-white px-6 text-neutral-900 hover:bg-neutral-100">
              Talk to Sales
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <Link to="/contact" className="flex-1">
          <Button variant="outline" className="w-full rounded-full border-neutral-300 bg-white text-neutral-900">
            Talk to Sales
          </Button>
        </Link>
        <Link to="/auth" search={{ redirect: "/setup" }} className="flex-1">
          <Button className="w-full rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
            Start Free Setup
          </Button>
        </Link>
      </div>
    </div>
  );
}
