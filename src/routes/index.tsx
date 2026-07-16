import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Zap,
  Workflow,
  Globe,
  Check,
  Sparkles,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL_DAYS } from "@/lib/pricing";
import { listPublicPlans } from "@/lib/billing.functions";
import { CtaButton } from "@/components/pricing/cta-button";
import { useIsAuthed } from "@/hooks/use-is-authed";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "RRLabs — AI Revenue Recovery Platform for Subscription Businesses" },
      {
        name: "description",
        content:
          "RRLabs is an AI revenue recovery platform that automatically recovers failed subscription payments, reduces involuntary churn, and protects recurring revenue. Native Stripe, LemonSqueezy, and Paddle support.",
      },
      {
        name: "keywords",
        content:
          "AI revenue recovery, failed payment recovery, subscription retention, involuntary churn, dunning automation, Stripe recovery, subscription billing recovery, revenue intelligence",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.rrlabs.online/" },
      { property: "og:title", content: "RRLabs — AI Revenue Recovery Platform" },
      {
        property: "og:description",
        content:
          "Recover failed subscription payments automatically with AI-personalized messaging across email and WhatsApp.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": "https://www.rrlabs.online/#webpage",
              url: "https://www.rrlabs.online/",
              name: "RRLabs — AI Revenue Recovery Platform for Subscription Businesses",
              description:
                "AI revenue recovery platform that automatically recovers failed subscription payments and reduces involuntary churn.",
              inLanguage: "en",
              isPartOf: { "@id": "https://www.rrlabs.online/#website" },
              about: { "@id": "https://www.rrlabs.online/#organization" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://www.rrlabs.online/",
                },
              ],
            },
            {
              "@type": "SoftwareApplication",
              name: "RRLabs",
              applicationCategory: "BusinessApplication",
              applicationSubCategory: "AI Revenue Recovery Platform",
              operatingSystem: "Web",
              description:
                "AI-powered platform for recovering failed subscription payments, reducing involuntary churn, and protecting recurring revenue.",
              featureList: [
                "Failed payment detection and decline-reason classification",
                "AI-personalized recovery messaging",
                "Multi-channel delivery across email and WhatsApp",
                "Smart retry scheduling",
                "Network tokens and Account Updater support",
                "Real-time recovery analytics",
              ],
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: "0",
                offerCount: "4",
              },
              publisher: { "@id": "https://www.rrlabs.online/#organization" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "How does RRLabs recover failed subscription payments?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "RRLabs connects to a billing provider (Stripe, LemonSqueezy, Paddle, or any provider exposing failed-payment webhooks), detects failed charges in real time, classifies the decline reason, generates AI-personalized recovery messaging, and delivers it across email and WhatsApp on optimized retry cadences.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is involuntary churn and why does it matter?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Involuntary churn is customer loss caused by failed payments — expired cards, insufficient funds, bank declines, or 3DS challenges — rather than a deliberate cancellation. For most subscription businesses it represents a material share of total churn and is directly addressable with the right retry and messaging strategy.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How quickly can a team go live with RRLabs?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Standard setup takes under 15 minutes: connect a billing provider, verify a sender domain, and enable the recovery engine. No custom engineering work is required for standard configurations.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Which payment providers does RRLabs support?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Native integrations for Stripe, LemonSqueezy, and Paddle. Any provider exposing a failed-payment webhook can be connected via the generic webhook endpoint.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is customer data secure on RRLabs?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Credentials are encrypted with AES-256, data is scoped with row-level security, access is controlled with role-based permissions, and every action is written to an immutable audit log. Card numbers, CVVs, and other PCI data never enter the RRLabs platform.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
});

function Landing() {
  const authed = useIsAuthed();
  const { data: serverPlans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => listPublicPlans(),
    staleTime: 60_000,
  });
  return (
    <div className="min-h-screen bg-background">
      {/* Announcement */}
      <div className="border-b border-border/60 bg-secondary/50">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-foreground" />
          <span className="text-foreground">New:</span>
          <span>AI Recovery Copywriter v2 — per-customer messaging tuned to decline reason.</span>
          <Link
            to="/blog"
            className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
          >
            Read the post
          </Link>
        </div>
      </div>

      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              AI Revenue Recovery Platform
            </div>
            <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Recover failed subscription payments, automatically.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              RRLabs is the AI revenue recovery platform for subscription businesses. Detect failed
              charges the moment they happen, generate personalized recovery messaging in your
              brand voice, and deliver it across email and WhatsApp on optimized retry cadences —
              without adding engineering work.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" search={{ redirect: "/checkout" }}>
                <Button size="lg">
                  Start free trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>

          {/* Capability card — factual, no invented metrics */}
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border/60 sm:grid-cols-3">
              {[
                { k: "Real-time", v: "Failed-charge detection via provider webhooks" },
                { k: "Per-customer", v: "AI-generated recovery messaging in your voice" },
                { k: "Multi-channel", v: "Coordinated email and WhatsApp cadences" },
              ].map((m) => (
                <div key={m.v} className="bg-card px-6 py-8 text-center">
                  <div className="text-2xl font-semibold text-foreground">{m.k}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Cost → Solution */}
      <section className="border-y border-border/60 bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              The involuntary churn problem
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              A meaningful share of subscription revenue fails silently every month.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Expired cards, insufficient funds, bank declines, and 3DS challenges account for a
              material fraction of subscription churn. Generic retry logic and template dunning
              emails address a portion of it and leave the rest on the table.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {PROBLEM_COST_SOLUTION.map((c) => (
              <div key={c.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {c.title}
                </h3>
                <p className="mt-3 text-base text-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key benefits */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-4xl font-semibold tracking-tight text-foreground">
              Recovery, not dunning.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Template-based dunning treats every failed payment the same. RRLabs classifies the
              decline reason, chooses the right channel and cadence for the customer, and generates
              messaging that reads like it was written by your team.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <b.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground">
            Everything you need to stop losing revenue.
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="h-6 w-6 text-foreground" />
                <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-foreground">
                How the AI Recovery Engine works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Fully automated from webhook to recovered charge. Nothing to babysit.
              </p>
            </div>
            <ol className="space-y-6">
              {WORKFLOW.map((s, i) => (
                <li key={s.title} className="flex gap-5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-sm font-semibold text-foreground">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Comparison — Template dunning vs. RRLabs */}
      <section className="border-y border-border/60 bg-secondary/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              How RRLabs differs from template dunning
            </h2>
            <p className="mt-4 text-muted-foreground">
              A capability comparison against the traditional retry-plus-template approach that
              ships with most billing platforms.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-border/60 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Capability</th>
                  <th className="px-6 py-4 font-medium">Template dunning</th>
                  <th className="px-6 py-4 font-medium">RRLabs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {COMPARISON.map((row) => (
                  <tr key={row.capability}>
                    <td className="px-6 py-4 font-medium text-foreground">{row.capability}</td>
                    <td className="px-6 py-4 text-muted-foreground">{row.template}</td>
                    <td className="px-6 py-4 text-foreground">{row.rrlabs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="border-b border-border/60 bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
            Works with the tools you already use
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Native integrations for the leading billing, messaging, and analytics platforms.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {INTEGRATIONS.map((n) => (
              <div
                key={n}
                className="flex h-16 items-center justify-center rounded-xl border border-border/60 bg-card px-4 text-sm font-medium text-foreground"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-foreground">
              Pricing that scales with recovered revenue
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Pay only when we recover revenue for you.
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const server = serverPlans?.find((s) => s.code === plan.code);
              const hasVariant = server ? server.has_variant : true;
              return (
                <div
                  key={plan.code}
                  className={`relative flex flex-col rounded-2xl border p-8 ${plan.highlight ? "border-foreground bg-card shadow-sm" : "border-border/60 bg-card"}`}
                >
                  {plan.highlight ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                      Most Popular
                    </span>
                  ) : null}
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  {plan.priceLead ? (
                    <p className="mt-2 text-xs text-muted-foreground">{plan.priceLead}</p>
                  ) : null}
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold text-foreground">{plan.price}</span>
                    {plan.priceSuffix ? (
                      <span className="text-sm text-muted-foreground">{plan.priceSuffix}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-medium text-foreground">{plan.successFee}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.tagline}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <CtaButton
                      plan={plan}
                      isAuthenticated={!!authed}
                      hasCheckoutVariant={hasVariant}
                      planIdForCheckout={server?.id ?? null}
                      variant={plan.highlight ? "primary" : "outline"}
                      fullWidth
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {TRIAL_DAYS}-day free trial · No credit card required · Cancel anytime
          </p>
          <div className="mt-6 text-center">
            <Link
              to="/pricing"
              className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              Compare all plans →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-secondary/40 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <dl className="mt-12 divide-y divide-border/60">
            {FAQ.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="text-base font-medium text-foreground">{item.q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 text-center">
            <Link
              to="/faq"
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              See all questions →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-secondary/60 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground">
            Start recovering revenue today.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Free 14-day trial. No credit card. Connect your billing provider in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ redirect: "/checkout" }}>
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact-sales">
              <Button size="lg" variant="outline">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

const PROBLEM_COST_SOLUTION = [
  {
    title: "The problem",
    body: "Failed payments cancel subscriptions the customer never intended to end.",
  },
  {
    title: "The cost",
    body: "Lost recurring revenue, longer payback periods, and higher acquisition-to-recovery ratios.",
  },
  {
    title: "The RRLabs approach",
    body: "AI-personalized recovery across the right channels at the right time — measured against recovered MRR, not emails sent.",
  },
];

const BENEFITS = [
  {
    icon: Zap,
    title: "Decline-reason-aware retries",
    body: "Retry timing adapts to issuer behavior, decline code, and prior success windows — not a fixed schedule.",
  },
  {
    icon: Bot,
    title: "AI-personalized copy",
    body: "Every message is generated for the specific customer, plan, tenure, and decline reason — never a template.",
  },
  {
    icon: MessageSquare,
    title: "Email + WhatsApp",
    body: "Reach customers on the channels they respond on. Channel selection adapts to prior engagement signals.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-grade security",
    body: "AES-256 credential encryption, row-level security, role-based access control, and immutable audit logs.",
  },
  {
    icon: LineChart,
    title: "Live recovery analytics",
    body: "Recovered MRR, recovery rate by cohort, channel performance, and forecasted impact — updated in real time.",
  },
  {
    icon: Workflow,
    title: "Zero-touch automation",
    body: "Configure once. Every failed charge is classified, messaged, retried, and attributed automatically.",
  },
];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Recovery Copywriter",
    body: "Generates recovery emails and WhatsApp messages tuned to plan, tenure, decline reason, and brand voice.",
  },
  {
    icon: Zap,
    title: "Smart retry engine",
    body: "Retries at times informed by issuer, card BIN, and historical success windows for each cohort.",
  },
  {
    icon: MessageSquare,
    title: "Multi-channel delivery",
    body: "Email via Resend or SMTP, WhatsApp via the Meta Cloud API, and SMS via Twilio.",
  },
  {
    icon: ShieldCheck,
    title: "Network tokens & Account Updater",
    body: "Card lifecycle management via network tokens and issuer-driven Account Updater flows.",
  },
  {
    icon: LineChart,
    title: "Recovery analytics",
    body: "Recovered MRR, recovery rate, cohort curves, channel breakdown, and forecast in one dashboard.",
  },
  {
    icon: Globe,
    title: "Global-ready",
    body: "Multi-currency, localized payment methods, and GDPR-compliant retention out of the box.",
  },
];

const WORKFLOW = [
  {
    title: "Failed payment detected",
    body: "A webhook fires the moment a charge fails — Stripe, LemonSqueezy, Paddle, or a custom provider.",
  },
  {
    title: "Root cause classified",
    body: "Decline code, card BIN, and customer history map the failure to the appropriate recovery pattern.",
  },
  {
    title: "AI drafts personalized message",
    body: "A Gemini-powered copywriter generates channel-specific messaging in your brand voice.",
  },
  {
    title: "Optimal send time chosen",
    body: "Retry schedule and messaging cadence adapt to issuer, timezone, and prior engagement signals.",
  },
  {
    title: "Delivered across channels",
    body: "Email and WhatsApp fire on the schedule that best fits the customer segment.",
  },
  {
    title: "Charge retried & attributed",
    body: "Successful retries are attributed to the recovery message; unsuccessful ones update the model.",
  },
];

const COMPARISON = [
  {
    capability: "Retry strategy",
    template: "Fixed schedule (e.g. day 1, 3, 5, 7)",
    rrlabs: "Adaptive to decline reason, issuer, and card BIN",
  },
  {
    capability: "Message content",
    template: "One template per step",
    rrlabs: "Per-customer AI generation in your brand voice",
  },
  {
    capability: "Channels",
    template: "Email only",
    rrlabs: "Email + WhatsApp + SMS, coordinated",
  },
  {
    capability: "Failure classification",
    template: "None",
    rrlabs: "Decline codes mapped to recovery patterns",
  },
  {
    capability: "Attribution",
    template: "Send counts",
    rrlabs: "Recovered MRR attributed to message + channel",
  },
  {
    capability: "Card lifecycle",
    template: "Manual",
    rrlabs: "Network tokens and Account Updater built in",
  },
];

const INTEGRATIONS = [
  "Stripe",
  "LemonSqueezy",
  "Paddle",
  "Resend",
  "WhatsApp",
  "Twilio",
  "Segment",
  "PostHog",
  "Slack",
  "Webhooks",
  "SMTP",
  "API",
];

const FAQ = [
  {
    q: "How does RRLabs recover failed subscription payments?",
    a: "RRLabs connects to your billing provider, detects failed charges in real time, classifies the decline reason, and sends AI-personalized recovery messaging across email and WhatsApp on optimized retry cadences.",
  },
  {
    q: "What is involuntary churn and why does it matter?",
    a: "Involuntary churn is customer loss caused by failed payments rather than a deliberate cancellation — expired cards, insufficient funds, bank declines, and 3DS challenges. It is directly addressable with the right retry and messaging strategy.",
  },
  {
    q: "How quickly can a team go live with RRLabs?",
    a: "Standard setup takes under 15 minutes: connect a billing provider, verify a sender domain, and enable the recovery engine.",
  },
  {
    q: "Which payment providers does RRLabs support?",
    a: "Stripe, LemonSqueezy, Paddle, and any provider exposing a failed-payment webhook via the generic webhook endpoint.",
  },
  {
    q: "Is customer data secure?",
    a: "Yes. Credentials are AES-256 encrypted, data access is scoped with row-level security and role-based permissions, and every action is written to an immutable audit log. PCI data never enters the platform.",
  },
];
