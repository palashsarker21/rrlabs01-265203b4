import { createFileRoute, Link } from "@tanstack/react-router";
import { buildBreadcrumbScript, canonicalFor } from "@/lib/seo/breadcrumbs";
import { ArrowRight, ShieldCheck, Sparkles, HeartHandshake, Rocket, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SocialLinks } from "@/components/social-links";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: `About — ${BRAND.name}` },
      {
        name: "description",
        content: `${BRAND.company} is the enterprise AI platform for revenue recovery and subscription retention. Learn about our mission, values, and how we help SaaS and eCommerce teams stop losing money to failed payments.`,
      },
      { property: "og:title", content: `About ${BRAND.name}` },
      {
        property: "og:description",
        content: `Meet the team behind the Recovery Engine — mission, values, security, and roadmap.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: canonicalFor("/about") }],
    scripts: [buildBreadcrumbScript([{ name: "About", path: "/about" }])],
  }),
});

const VALUES = [
  {
    icon: HeartHandshake,
    title: "Customer-first",
    body: "Every product decision starts with the operator running billing at 2 a.m. If it doesn't help them recover revenue faster and with less risk, we don't ship it.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Tenant isolation via row-level security, encrypted credentials, least-privilege access, and continuous audit logging are defaults — not upgrades.",
  },
  {
    icon: Sparkles,
    title: "Responsible AI",
    body: "AI drafts every recovery message, but humans set the boundaries. We publish our behavior, avoid dark patterns, and never fabricate customer facts.",
  },
  {
    icon: Rocket,
    title: "Ship the outcome",
    body: "We measure success by recovered revenue, not features shipped. If the metric doesn't move, the feature isn't done.",
  },
  {
    icon: Globe2,
    title: "Built for global teams",
    body: "Multi-currency, multi-language, multi-timezone from day one. Recovery messaging respects quiet hours, local regulation, and channel preference.",
  },
];

function AboutPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          About {BRAND.company}
        </p>
        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Subscription revenue shouldn&apos;t leak.
        </h1>
        <div className="mt-8 space-y-5 text-base text-muted-foreground">
          <p>
            Between 5% and 15% of every recurring payment fails silently — expired cards, bank
            declines, 3DS challenges, insufficient funds, network timeouts. Most finance and
            customer success teams find out weeks later, when a healthy subscriber has already
            churned. By then the cost is compounded: lost lifetime value, wasted acquisition spend,
            and a customer relationship that&apos;s harder to rebuild than it was to keep.
          </p>
          <p>
            {BRAND.company} builds the platform we wished we&apos;d had. The Recovery Engine listens
            to your payment provider in real time, classifies why each charge failed, drafts warm,
            on-brand copy per customer, and follows up across email and WhatsApp until the customer
            actually pays. It runs quietly in the background, respects consent and quiet hours, and
            reports every recovered dollar in a live dashboard.
          </p>
        </div>

        <section aria-labelledby="mission" className="mt-14">
          <h2 id="mission" className="text-2xl font-semibold tracking-tight text-foreground">
            Mission
          </h2>
          <p className="mt-3 text-muted-foreground">
            Give every subscription and eCommerce business the same recovery infrastructure that
            top-tier SaaS companies build internally — without the six-month build.
          </p>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">Vision</h2>
          <p className="mt-3 text-muted-foreground">
            A world where involuntary churn is a solved problem, and finance, growth, and customer
            success teams share a single source of truth for recovery outcomes.
          </p>

          <h2 className="mt-10 text-2xl font-semibold tracking-tight text-foreground">
            Why we exist
          </h2>
          <p className="mt-3 text-muted-foreground">
            The subscription economy runs on retries, dunning emails, and manual chase-ups. Most
            teams stitch together a payment provider, an email tool, a spreadsheet, and hope.
            {BRAND.name} replaces that with a single, opinionated system: connect once, verify
            deliverability once, and let the engine do the rest.
          </p>
        </section>

        <section aria-labelledby="values" className="mt-14">
          <h2 id="values" className="text-2xl font-semibold tracking-tight text-foreground">
            Values
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-border/60 bg-card/50 p-5">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="platform" className="mt-14">
          <h2 id="platform" className="text-2xl font-semibold tracking-tight text-foreground">
            The platform
          </h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>
              {BRAND.name} unifies three surfaces that used to live in separate tools: real-time
              billing events from your provider, an AI classification and messaging layer, and a
              revenue analytics workspace. Everything is multi-tenant by design and scoped to your
              workspace with row-level security at the database.
            </p>
            <p>
              Under the hood, our reliable retry engine schedules follow-ups across timezones,
              respects quiet hours and consent, and rotates channels automatically when a message
              can&apos;t be delivered. The learning loop feeds every outcome back into future
              decisions, so cadence, wording, and channel selection improve with every recovered
              charge.
            </p>
          </div>
        </section>

        <section aria-labelledby="trust" className="mt-14">
          <h2 id="trust" className="text-2xl font-semibold tracking-tight text-foreground">
            Security, privacy, and trust
          </h2>
          <p className="mt-3 text-muted-foreground">
            We treat customer data like the sensitive asset it is. Provider credentials are
            AES-256-GCM encrypted server-side, every table is scoped to a workspace, and
            authentication supports SSO and role-based access control. Read the full detail on our{" "}
            <Link to="/security" className="text-foreground underline underline-offset-4">
              Security
            </Link>{" "}
            page and our{" "}
            <Link to="/privacy" className="text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="roadmap" className="mt-14">
          <h2 id="roadmap" className="text-2xl font-semibold tracking-tight text-foreground">
            Where we&apos;re going
          </h2>
          <p className="mt-3 text-muted-foreground">
            Expanded payment provider coverage, deeper analytics on cohort recovery, an even more
            autonomous AI recovery engine that adapts messaging in real time, and a customer
            self-service portal for payment updates and pauses. Every roadmap item is chosen against
            a single test: does it move recovered revenue for our customers?
          </p>
        </section>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link to="/auth" search={{ redirect: "/checkout" }}>
            <Button size="lg">
              Start Free 14-Day Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/contact-sales">
            <Button size="lg" variant="outline">
              Talk to Sales
            </Button>
          </Link>
        </div>

        <section aria-labelledby="follow-rrlabs" className="mt-16 border-t border-border/60 pt-10">
          <h2 id="follow-rrlabs" className="text-2xl font-semibold tracking-tight text-foreground">
            Follow {BRAND.company}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Product updates, engineering deep-dives, and payment-recovery research — straight from
            the team.
          </p>
          <SocialLinks className="mt-6" ariaLabel={`${BRAND.name} on social media`} />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
