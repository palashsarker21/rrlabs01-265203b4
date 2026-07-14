import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "RRLabs — AI Revenue Recovery for Subscription Businesses" },
      {
        name: "description",
        content:
          "Recover failed subscription payments automatically with AI-personalized email and WhatsApp. Connect Stripe or LemonSqueezy in minutes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.rrlabs.online/" },
      { property: "og:title", content: "RRLabs — AI Revenue Recovery for Subscription Businesses" },
      {
        property: "og:description",
        content:
          "Recover failed subscription payments automatically with AI-personalized email and WhatsApp.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Revenue Recovery Labs",
          url: "https://www.rrlabs.online",
        }),
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Announcement */}
      <div className="border-b border-border/60 bg-secondary/50">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-foreground" />
          <span className="text-foreground">New:</span>
          <span>AI Recovery Copywriter v2 — 34% higher recovery on cold-lapsed subs.</span>
          <Link to="/blog" className="ml-1 font-medium text-foreground underline-offset-2 hover:underline">
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
              Connect your billing stack. RRLabs detects failed charges in real time, sends
              AI-personalized recovery messages on optimal retry cadences, and turns
              involuntary churn into recovered revenue.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" search={{ redirect: "/app" }}>
                <Button size="lg">
                  Start free — no card required
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">See pricing</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">14-day free trial · Cancel anytime</p>
          </div>

          {/* Metric card */}
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border/60 sm:grid-cols-3">
              {[
                { k: "38%", v: "avg. recovery uplift" },
                { k: "$4.2M+", v: "recovered for customers" },
                { k: "<12 min", v: "average time to live" },
              ].map((m) => (
                <div key={m.v} className="bg-card px-6 py-8 text-center">
                  <div className="text-3xl font-semibold text-foreground">{m.k}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-border/60 bg-secondary/40 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
            Trusted by modern subscription businesses
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-6 opacity-70 sm:grid-cols-3 md:grid-cols-6">
            {["Northwind", "Acme SaaS", "Loopr", "Payhaven", "Subwise", "Metrable"].map((n) => (
              <div key={n} className="text-center text-sm font-semibold text-foreground/70">{n}</div>
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
              Generic retry schedules recover ~15%. RRLabs recovers 35–45% by combining
              intelligent retry timing, AI-personalized messaging, and multi-channel delivery.
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
                The AI Recovery Workflow
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

      {/* Integrations */}
      <section className="border-y border-border/60 bg-secondary/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
            Works with the tools you already use
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Native integrations with the leading billing, messaging, and analytics platforms.
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
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-8 ${p.featured ? "border-foreground bg-card shadow-sm" : "border-border/60 bg-card"}`}
              >
                <h3 className="text-lg font-semibold text-foreground">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-foreground">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.tagline}</p>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/pricing" className="mt-8 block">
                  <Button variant={p.featured ? "default" : "outline"} className="w-full">
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-border/60 bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
            Teams who ship revenue faster
          </h2>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-border/60 bg-card p-6">
                <blockquote className="text-sm leading-relaxed text-foreground">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 text-sm">
                  <div className="font-medium text-foreground">{t.name}</div>
                  <div className="text-muted-foreground">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
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
            <Link to="/faq" className="text-sm font-medium text-foreground underline-offset-2 hover:underline">
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
            <Link to="/auth" search={{ redirect: "/app" }}>
              <Button size="lg">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline">Talk to sales</Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

const BENEFITS = [
  { icon: Zap, title: "Recover 35–45%", body: "Beat industry-standard dunning by 2–3× with smart retries and AI copy tuned to decline reason." },
  { icon: Bot, title: "AI-personalized copy", body: "Every message is written for the specific customer, plan, and reason for failure — no templates." },
  { icon: MessageSquare, title: "Email + WhatsApp", body: "Reach customers where they respond. Automatic channel selection based on prior engagement." },
  { icon: ShieldCheck, title: "Enterprise security", body: "AES-256 encryption, RLS-scoped data, RBAC, and audit logs from day one." },
  { icon: LineChart, title: "Live revenue analytics", body: "Cohort recovery rate, MRR saved, and channel performance updated in real time." },
  { icon: Workflow, title: "Zero-touch automation", body: "Set once. Every failed charge triggers the right recovery flow, automatically." },
];

const FEATURES = [
  { icon: Bot, title: "AI Recovery Copywriter", body: "Generates recovery emails and WhatsApp messages tuned to plan, tenure, and decline reason." },
  { icon: Zap, title: "Smart retry engine", body: "Retries at optimal times based on issuer, card BIN, and historical success windows." },
  { icon: MessageSquare, title: "Multi-channel delivery", body: "Email via Resend or SMTP, WhatsApp via Meta Cloud API, SMS via Twilio." },
  { icon: ShieldCheck, title: "Network tokens & AU", body: "Automatic card lifecycle management via Account Updater and network tokens." },
  { icon: LineChart, title: "Recovery analytics", body: "Recovered MRR, recovery rate, cohort curves, channel breakdown, and forecast." },
  { icon: Globe, title: "Global-ready", body: "Multi-currency, localized payment methods, GDPR-compliant retention out of the box." },
];

const WORKFLOW = [
  { title: "Failed payment detected", body: "Webhook fires the moment a charge fails — Stripe, LemonSqueezy, Paddle, or custom." },
  { title: "Root cause classified", body: "Decline code, card BIN, and customer history map the failure to one of 30+ recovery patterns." },
  { title: "AI drafts personalized message", body: "Gemini-powered copywriter generates channel-specific messaging in your brand voice." },
  { title: "Optimal send time chosen", body: "Retry schedule and messaging cadence adapt to issuer, timezone, and prior engagement." },
  { title: "Delivered across channels", body: "Email and WhatsApp fire on the schedule that maximizes recovery for this customer segment." },
  { title: "Charge retried & attributed", body: "Successful retries are attributed to the recovery message; failures update the model." },
];

const INTEGRATIONS = ["Stripe", "LemonSqueezy", "Paddle", "Resend", "WhatsApp", "Twilio", "Segment", "PostHog", "Slack", "Webhooks", "SMTP", "API"];

const PLANS = [
  { name: "Starter", price: "$0", period: "/mo", tagline: "For teams testing the water.", cta: "Start free",
    features: ["Up to 100 recoveries/mo", "Email + AI copywriter", "Basic dashboard", "Community support"], featured: false },
  { name: "Growth", price: "$149", period: "/mo", tagline: "Scale recovery with confidence.", cta: "Start Growth",
    features: ["Up to 5,000 recoveries/mo", "Email + WhatsApp + SMS", "Full analytics", "Priority support"], featured: true },
  { name: "Business", price: "$499", period: "/mo", tagline: "For high-volume subscription businesses.", cta: "Contact sales",
    features: ["Unlimited recoveries", "Custom workflows", "Advanced analytics + export", "Dedicated CSM"], featured: false },
];

const TESTIMONIALS = [
  { quote: "We recovered $180K in the first 90 days with almost no engineering time. RRLabs is now a permanent line in our forecast.", name: "Priya Menon", role: "COO, Loopr" },
  { quote: "The AI copy is genuinely good. Our customers reply to recovery emails asking questions — that's a first.", name: "Marc Delacroix", role: "Head of Growth, Payhaven" },
  { quote: "Setup took 11 minutes. Recovery rate went from 14% to 41% in the first month.", name: "Sana Ito", role: "Founder, Metrable" },
];

const FAQ = [
  { q: "How does RRLabs recover failed payments?", a: "We connect to your billing provider, detect failed charges in real time, and send AI-personalized recovery messages across email and WhatsApp on optimal retry cadences." },
  { q: "How fast can I go live?", a: "Most teams are live in under 15 minutes: connect your provider, verify your sender domain, enable the recovery engine." },
  { q: "Which payment providers are supported?", a: "Stripe, LemonSqueezy, Paddle, and any provider exposing a failed-payment webhook." },
  { q: "Is customer data secure?", a: "Yes. AES-256 encryption for credentials, RLS-scoped data access, RBAC, and audit logs." },
];
