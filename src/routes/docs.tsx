import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Webhook, Mail, MessageCircle, Sparkles, ShieldCheck } from "lucide-react";

import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Docs — RRLabs" },
      {
        name: "description",
        content:
          "Setup guides for RRLabs: connect Stripe, Resend, WhatsApp, configure webhooks, and understand the AI recovery cadence.",
      },
      { property: "og:title", content: "RRLabs Docs" },
      {
        property: "og:description",
        content: "Everything you need to launch AI-driven payment recovery in under 10 minutes.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Documentation</h1>
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Get RRLabs recovering revenue in under ten minutes. Start with the quickstart, then jump
          to the reference sections you need.
        </p>

        <nav className="mt-8 grid gap-3 sm:grid-cols-2">
          <TocCard href="#quickstart" icon={<Sparkles className="h-4 w-4" />} title="Quickstart" />
          <TocCard href="#stripe" icon={<Webhook className="h-4 w-4" />} title="Stripe webhook" />
          <TocCard href="#email" icon={<Mail className="h-4 w-4" />} title="Email (Resend)" />
          <TocCard
            href="#whatsapp"
            icon={<MessageCircle className="h-4 w-4" />}
            title="WhatsApp Cloud"
          />
          <TocCard href="#cadence" icon={<Sparkles className="h-4 w-4" />} title="AI cadence" />
          <TocCard href="#security" icon={<ShieldCheck className="h-4 w-4" />} title="Security" />
        </nav>

        <Section id="quickstart" title="Quickstart">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Create your account and pick a plan on the checkout page.</li>
            <li>
              Open the <strong>Setup Wizard</strong> and connect your payment gateway, email
              provider, and WhatsApp channel.
            </li>
            <li>
              Paste the workspace-specific Stripe webhook URL shown on the dashboard into your
              Stripe account.
            </li>
            <li>
              Activate the workspace — the recovery engine begins analyzing every failed payment in
              real time.
            </li>
          </ol>
        </Section>

        <Section id="stripe" title="Stripe webhook">
          <p>
            Every workspace has a unique webhook URL of the form{" "}
            <Code>/api/public/webhooks/stripe?w=&lt;workspace_id&gt;</Code>. In your Stripe
            dashboard, add an endpoint that points at this URL and subscribe to these events:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>
              <Code>payment_intent.payment_failed</Code>
            </li>
            <li>
              <Code>invoice.payment_failed</Code>
            </li>
            <li>
              <Code>charge.failed</Code>
            </li>
            <li>
              <Code>payment_intent.succeeded</Code>
            </li>
            <li>
              <Code>invoice.payment_succeeded</Code>
            </li>
          </ul>
          <p className="mt-3">
            Copy the endpoint&apos;s <strong>signing secret</strong> into the Stripe integration
            inside RRLabs. Every request is verified with HMAC before we touch your data.
          </p>
        </Section>

        <Section id="email" title="Email (Resend)">
          <p>
            RRLabs delivers recovery emails through Resend. Create an API key at{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              resend.com/api-keys
            </a>{" "}
            and add it in the setup wizard along with a verified <em>from</em> address. Deliveries
            appear in the recovery event drawer with provider IDs for tracing.
          </p>
        </Section>

        <Section id="whatsapp" title="WhatsApp Cloud">
          <p>
            Provide a permanent access token and the phone number ID from Meta Business Manager.
            RRLabs sends text messages via the Graph API and records the resulting message IDs
            against each recovery attempt.
          </p>
        </Section>

        <Section id="cadence" title="AI cadence">
          <p>
            When Stripe fires a failure, the engine analyzes the failure code with Gemini through
            the Lovable AI Gateway and picks a recommended action (retry, contact customer,
            escalate). Messages go out on a four-step cadence:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Step 0 — immediate</li>
            <li>Step 1 — 24 hours later</li>
            <li>Step 2 — day 3</li>
            <li>Step 3 — day 7, then the event is auto-abandoned</li>
          </ul>
          <p className="mt-3">
            Managers can override the wording per step and channel from the templates section.
          </p>
        </Section>

        <Section id="security" title="Security">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>All third-party credentials are AES-256-GCM encrypted at rest.</li>
            <li>Row-level security scopes every read and write to a workspace.</li>
            <li>Stripe webhooks require a valid signature per workspace.</li>
            <li>
              Every sensitive action (integrations, activations, retries) is written to an immutable
              audit log.
            </li>
          </ul>
        </Section>

        <div className="mt-16 rounded-2xl border border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
          Ready to start recovering revenue?{" "}
          <Link to="/auth" className="text-primary underline underline-offset-4">
            Create your account
          </Link>
          .
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

function TocCard({ href, title, icon }: { href: string; title: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
    >
      <span className="text-primary">{icon}</span>
      {title}
    </a>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="prose prose-invert mt-3 max-w-none text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}
