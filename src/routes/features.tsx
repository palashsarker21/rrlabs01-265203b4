import { createFileRoute, Link } from "@tanstack/react-router";
import { buildBreadcrumbScript, canonicalFor } from "@/lib/seo/breadcrumbs";
import {
  ArrowRight,
  Bot,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features — RRLabs AI Revenue Recovery" },
      {
        name: "description",
        content:
          "Multi-touch AI cadence, Stripe integration, email + WhatsApp dispatch, live analytics, and enterprise-grade security.",
      },
      { property: "og:title", content: "RRLabs Features" },
      {
        property: "og:description",
        content: "Everything the Recovery Engine ships with, out of the box.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: canonicalFor("/features") }],
    scripts: [buildBreadcrumbScript([{ name: "Features", path: "/features" }])],
  }),
});

const FEATURES = [
  {
    icon: Bot,
    title: "Gemini-powered analysis",
    body: "Every failed payment is triaged by Gemini via the Lovable AI Gateway. It classifies the failure and drafts warm, on-brand copy per customer.",
  },
  {
    icon: Workflow,
    title: "Multi-touch cadence",
    body: "Automatic follow-ups at 0h, +1 day, +3 days, and +7 days. Templates can be overridden per workspace per step.",
  },
  {
    icon: MessageSquare,
    title: "Email + WhatsApp",
    body: "Send via Resend and Meta WhatsApp Cloud API. Delivery status and provider IDs are tracked per attempt.",
  },
  {
    icon: LineChart,
    title: "Live dashboard",
    body: "Recovered revenue, recovery rate, at-risk amount, event stream — updated in real time as Stripe fires webhooks.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant by design",
    body: "Organizations, workspaces, member roles, and row-level security. Every table is scoped to the right workspace.",
  },
  {
    icon: Lock,
    title: "Encrypted credentials",
    body: "Provider secrets are AES-256-GCM encrypted server-side. Nothing sensitive ever reaches the browser.",
  },
  {
    icon: Zap,
    title: "One-click connect",
    body: "Every integration ships with Connect, Test, Disconnect, and Health Status. Auto-verify moves the workspace to Active.",
  },
  {
    icon: Layers,
    title: "Reusable adapters",
    body: "Stripe, Resend, WhatsApp Cloud today; the adapter registry lets us add gateways and channels without core changes.",
  },
];

const USE_CASES = [
  {
    title: "SaaS subscriptions",
    body: "Recover expired cards, 3DS challenges, and insufficient funds across monthly and annual plans. Reduce involuntary churn without touching your billing stack.",
  },
  {
    title: "eCommerce subscribe-and-save",
    body: "Rescue failed renewals on recurring shipments, coordinate with your OMS, and keep replenishment cadences intact.",
  },
  {
    title: "Membership and communities",
    body: "Personalized recovery messages for member renewals with quiet hours and multi-language cadences.",
  },
  {
    title: "Agencies and platforms",
    body: "Run recovery for multiple client workspaces from one dashboard with tenant isolation and per-workspace analytics.",
  },
];

const OUTCOMES = [
  { label: "Time to live", value: "< 15 minutes" },
  { label: "Recovery cadence touches", value: "0h / +1d / +3d / +7d" },
  { label: "Channels", value: "Email + WhatsApp" },
  { label: "Tenant isolation", value: "Row-level security" },
];

const FAQ = [
  {
    q: "How is this different from Stripe Smart Retries or built-in dunning?",
    a: "Provider-native retries handle the payment attempt. RRLabs handles the customer conversation around it — classifying the failure, drafting personalized copy, dispatching across channels, respecting consent and quiet hours, and reporting recovered revenue in one place.",
  },
  {
    q: "Do I need to be a developer to use RRLabs?",
    a: "No. Connect your provider, verify your sender domain, pick a template, and enable the engine. A developer can extend cadences, add custom fields, and integrate the API when needed.",
  },
  {
    q: "How is billing handled?",
    a: "Our Merchant of Record is Lemon Squeezy. Payments are securely processed by Lemon Squeezy, applicable taxes are calculated and collected where required, and invoices are issued through Lemon Squeezy. RRLabs does not directly store payment card details.",
  },
];

function FeaturesPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">Platform</p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            The Recovery Engine, end to end.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            A production platform for subscription and eCommerce businesses that lose revenue to
            failed payments. Everything below ships in the box — no glue code, no external
            orchestration, no separate email tool.
          </p>
        </div>

        <section aria-labelledby="problem" className="mt-14 grid gap-6 rounded-2xl border border-border/60 bg-card/40 p-8 md:grid-cols-2">
          <div>
            <h2 id="problem" className="text-xl font-semibold text-foreground">
              The problem
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              5%–15% of recurring charges fail. Most teams find out weeks later through a churn
              report, after acquisition spend has already been wasted. Dunning emails written once
              and never revisited quietly underperform for years.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">The solution</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Real-time failure detection, AI classification, personalized copy per customer,
              multi-touch cadence across email and WhatsApp, and a live dashboard that reports
              recovered revenue in dollars — not open rates.
            </p>
          </div>
        </section>

        <section aria-labelledby="capabilities" className="mt-16">
          <h2 id="capabilities" className="text-2xl font-semibold tracking-tight text-foreground">
            Capabilities
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur"
              >
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="outcomes" className="mt-16">
          <h2 id="outcomes" className="text-2xl font-semibold tracking-tight text-foreground">
            Business outcomes
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OUTCOMES.map((o) => (
              <div key={o.label} className="rounded-xl border border-border/60 bg-card/40 p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{o.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{o.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="use-cases" className="mt-16">
          <h2 id="use-cases" className="text-2xl font-semibold tracking-tight text-foreground">
            Who it&apos;s for
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {USE_CASES.map((u) => (
              <div key={u.title} className="rounded-xl border border-border/60 bg-card/40 p-6">
                <h3 className="text-base font-semibold text-foreground">{u.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{u.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="mor" className="mt-16 rounded-2xl border border-border/60 bg-card/40 p-8">
          <h2 id="mor" className="text-xl font-semibold text-foreground">
            Billing you can trust
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Our Merchant of Record is <strong>Lemon Squeezy</strong>. Payments are securely
            processed, taxes are calculated and collected where required, and invoices are issued
            through Lemon Squeezy — so you get enterprise-grade compliance without operating a
            payment stack. See our <Link to="/pricing" className="underline underline-offset-4">Pricing</Link>{" "}
            and <Link to="/refund" className="underline underline-offset-4">Refund Policy</Link> for
            full detail.
          </p>
        </section>

        <section aria-labelledby="faq" className="mt-16">
          <h2 id="faq" className="text-2xl font-semibold tracking-tight text-foreground">
            Frequently asked
          </h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q} className="border-b border-border/60 pb-4">
                <dt className="text-base font-medium text-foreground">{f.q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/auth" search={{ redirect: "/checkout" }}>
            <Button size="lg">
              Start Free 14-Day Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="outline">
              See pricing
            </Button>
          </Link>
          <Link to="/contact-sales">
            <Button size="lg" variant="ghost">
              Talk to Sales
            </Button>
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
