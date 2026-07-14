import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldCheck,
  BadgeCheck,
  CreditCard,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SITE_URL } from "@/lib/brand";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Enterprise plans that grow with your revenue | RRLabs" },
      {
        name: "description",
        content:
          "Enterprise pricing for AI-powered revenue recovery. Start free with a 14-day trial. Upgrade only when you're ready.",
      },
      { property: "og:title", content: "RRLabs Pricing" },
      {
        property: "og:description",
        content:
          "Enterprise pricing that grows with your revenue. 14-day free trial. No credit card required.",
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
  priceSuffix?: string;
  priceLead?: string;
  fee: string;
  feeLead?: string;
  tagline: string;
  featuresLead?: string;
  features: string[];
  cta: string;
  ctaTo: "/auth" | "/contact";
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    code: "starter",
    name: "Starter",
    price: "$29",
    priceSuffix: "/month",
    fee: "+5% success fee",
    tagline: "Perfect for startups.",
    features: [
      "AI Recovery",
      "Email Recovery",
      "WhatsApp Recovery",
      "Stripe",
      "Shopify",
      "WooCommerce",
      "Dashboard",
      "Analytics",
      "API",
      "Community Support",
    ],
    cta: "Start Free Trial",
    ctaTo: "/auth",
  },
  {
    code: "growth",
    name: "Growth",
    price: "$99",
    priceSuffix: "/month",
    fee: "+4% success fee",
    tagline: "For growing subscription businesses.",
    featuresLead: "Everything in Starter, plus",
    features: [
      "Advanced Analytics",
      "Customer Segmentation",
      "AI Recommendations",
      "Workflow Automation",
      "Unlimited Integrations",
      "Priority Support",
    ],
    cta: "Start Free Trial",
    ctaTo: "/auth",
    highlight: true,
  },
  {
    code: "business",
    name: "Business",
    price: "$299",
    priceSuffix: "/month",
    fee: "+3% success fee",
    tagline: "Built for high-volume SaaS.",
    featuresLead: "Everything in Growth, plus",
    features: [
      "Executive Dashboard",
      "Revenue Intelligence",
      "Predictive Analytics",
      "SSO Ready",
      "Enterprise Security",
      "Dedicated Success Manager",
    ],
    cta: "Start Free Trial",
    ctaTo: "/auth",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceLead: "Starting from $999/month",
    fee: "Starting from 2% success fee",
    tagline: "For enterprises with advanced requirements.",
    features: [
      "White Label",
      "Custom Domain",
      "Dedicated Infrastructure",
      "Dedicated AI",
      "Custom Integrations",
      "Enterprise SLA",
      "Professional Services",
      "Dedicated Engineer",
    ],
    cta: "Contact Sales",
    ctaTo: "/contact",
  },
];

const TRUST = [
  { icon: Sparkles, label: "14-Day Free Trial" },
  { icon: CreditCard, label: "No Credit Card Required" },
  { icon: BadgeCheck, label: "AI Powered" },
  { icon: ShieldCheck, label: "Enterprise Ready" },
];

type CompareValue = boolean | string;
const COMPARE_ROWS: {
  label: string;
  values: [CompareValue, CompareValue, CompareValue, CompareValue];
}[] = [
  { label: "AI Recovery", values: [true, true, true, true] },
  { label: "Analytics", values: ["Basic", "Advanced", "Advanced", "Custom"] },
  { label: "Revenue Intelligence", values: [false, false, true, true] },
  { label: "Workflow Automation", values: [false, true, true, true] },
  { label: "API", values: [true, true, true, true] },
  { label: "Webhooks", values: [true, true, true, true] },
  { label: "SSO", values: [false, false, true, true] },
  { label: "White Label", values: [false, false, false, true] },
  { label: "Support", values: ["Community", "Priority", "Dedicated CSM", "Dedicated Engineer"] },
  {
    label: "Communication Channels",
    values: [
      "Email + WhatsApp",
      "Email + WhatsApp",
      "Email + WhatsApp",
      "Email + WhatsApp + Custom",
    ],
  },
];

const FAQS = [
  {
    q: "What is the success fee?",
    a: "A small percentage of revenue we recover for you. No recovery, no fee.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The 14-day trial requires no card.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade, downgrade, or cancel anytime from your dashboard.",
  },
  {
    q: "Which channels are supported?",
    a: "Email and WhatsApp Business API on all plans.",
  },
  {
    q: "How does billing work?",
    a: "A fixed monthly subscription plus a small success fee on recovered revenue.",
  },
  {
    q: "Is my data secure?",
    a: "Encrypted in transit and at rest, with role-based access and audit logs.",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
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
          Recover failed payments automatically using AI-powered Email and WhatsApp recovery. Start
          free with a 14-day trial. Upgrade only when you're ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button
              size="lg"
              className="rounded-full bg-emerald-600 px-6 text-white hover:bg-emerald-700"
            >
              Start Free Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact">
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

function PlanGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <PlanCard key={p.code} plan={p} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-500">
        14-day free trial on all plans. No credit card required.
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
          ? "border-emerald-500/70 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/10"
          : "border-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.18)]")
      }
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most Popular
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-neutral-950">{plan.name}</h3>
        <p className="mt-1 text-sm text-neutral-600">{plan.tagline}</p>
      </div>

      <div className="mt-6 min-h-[92px]">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-neutral-950">
            {plan.price}
          </span>
          {plan.priceSuffix && <span className="text-sm text-neutral-500">{plan.priceSuffix}</span>}
        </div>
        {plan.priceLead && <p className="mt-1 text-xs text-neutral-500">{plan.priceLead}</p>}
        <p className="mt-1 text-xs font-medium text-emerald-700">{plan.fee}</p>
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
        <Link to={plan.ctaTo} className="block">
          <Button
            className={
              "w-full rounded-full transition-colors " +
              (highlight
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
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
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/70">
                <th className="p-4 text-left font-medium text-neutral-500">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.code} className="p-4 text-center font-semibold text-neutral-950">
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
                  <td className="p-4 text-neutral-800">{row.label}</td>
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

function ROICalculator() {
  const [revenue, setRevenue] = useState(50000);
  const [failedPct, setFailedPct] = useState(8);
  const [aov, setAov] = useState(49);
  const [recoveryRate, setRecoveryRate] = useState(35);

  const results = useMemo(() => {
    const failedRevenue = revenue * (failedPct / 100);
    const recovered = failedRevenue * (recoveryRate / 100);
    const platformCost = 99 + recovered * 0.04;
    const monthlyGain = recovered - platformCost;
    const annualGain = monthlyGain * 12;
    const roi = platformCost > 0 ? (monthlyGain / platformCost) * 100 : 0;
    return { recovered, monthlyGain, annualGain, platformCost, roi };
  }, [revenue, failedPct, recoveryRate]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  // aov is a UX input; not directly used in the simplified formula but shown as context
  void aov;

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

          <div className="rounded-2xl border border-neutral-200 bg-[#fafafa] p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              Estimated results
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <Result label="Recovered Revenue" value={fmt(results.recovered)} />
              <Result label="Monthly Gain" value={fmt(results.monthlyGain)} accent />
              <Result label="Annual Gain" value={fmt(results.annualGain)} accent />
              <Result label="Platform Cost" value={fmt(results.platformCost)} />
              <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-800">
                  ROI
                </p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-emerald-700">
                  {results.roi.toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="mt-6 text-xs text-neutral-500">
              Based on the Growth plan ($99/mo + 4% success fee). Estimates vary by industry and
              payment mix.
            </p>
            <Link to="/auth" className="mt-6 inline-block">
              <Button className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                Start Free Trial
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
          <Link to="/auth">
            <Button
              size="lg"
              className="rounded-full bg-emerald-600 px-6 text-white hover:bg-emerald-700"
            >
              Start Free Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-neutral-300 bg-white px-6 text-neutral-900 hover:bg-neutral-100"
            >
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
          <Button
            variant="outline"
            className="w-full rounded-full border-neutral-300 bg-white text-neutral-900"
          >
            Talk to Sales
          </Button>
        </Link>
        <Link to="/auth" className="flex-1">
          <Button className="w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
            Start Free Trial
          </Button>
        </Link>
      </div>
    </div>
  );
}
