import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SITE_URL, BRAND } from "@/lib/brand";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is RRLabs?",
    a: `${BRAND.company} is an enterprise AI platform for revenue recovery and subscription retention. It connects to your payment provider, detects failed charges in real time, classifies why each failed, and sends AI-personalized recovery messages across email and WhatsApp on optimal cadences.`,
  },
  {
    q: "How does RRLabs recover failed payments?",
    a: "We ingest webhook events from your billing provider, classify each failure (expired card, insufficient funds, 3DS challenge, hard decline, and more), and dispatch a multi-touch recovery cadence tuned to the failure reason, customer profile, and channel preference. Every touchpoint is measured, and outcomes feed back into future decisions.",
  },
  {
    q: "Which payment providers are supported?",
    a: "Stripe, Lemon Squeezy, and Paddle out of the box. Any provider that exposes a webhook for failed charges can be integrated through our adapter registry. Our Merchant of Record for subscription billing is Lemon Squeezy.",
  },
  {
    q: "Do I need to write recovery copy?",
    a: "No. Our AI generates copy tuned to your brand voice, customer segment, decline reason, and channel. You can review, edit, or approve messages before send, or run fully automated cadences with human override.",
  },
  {
    q: "Which channels are supported?",
    a: "Email via Resend and WhatsApp Business Cloud API today. SMS and in-app channels are on the roadmap. Every channel respects consent, quiet hours, and provider policy.",
  },
  {
    q: "How fast can I go live?",
    a: "Most teams are live in under 15 minutes: connect your provider, verify your sender domain, choose a template, and enable the Recovery Engine. Enterprise onboarding with SSO and custom cadences takes 1–2 weeks.",
  },
  {
    q: "Is my customer data safe?",
    a: "Yes. Credentials are AES-256-GCM encrypted server-side. Every table is scoped to your workspace via row-level security. Access is least-privilege and audit-logged. Read our Security page for full detail.",
  },
  {
    q: "Who is the Merchant of Record?",
    a: "Lemon Squeezy is our Merchant of Record. Payments are securely processed by Lemon Squeezy, applicable taxes are calculated and collected where required, and invoices are issued through Lemon Squeezy. RRLabs does not directly store payment card details.",
  },
  {
    q: "Can I cancel or get a refund?",
    a: "Yes. Monthly plans can be cancelled at any time and remain active until the end of the current period. Annual plans include a 14-day full refund window and a pro-rated refund on remaining unused months afterwards, less a small administrative fee. See our Refund Policy for details.",
  },
  {
    q: "Do you offer enterprise plans and SLAs?",
    a: "Yes. Enterprise plans include SSO, custom cadences, dedicated onboarding, a signed DPA, and enhanced SLAs. Contact sales for a tailored proposal.",
  },
  {
    q: "Where are you based, and which regions do you support?",
    a: "We are a distributed company serving primary markets in the United States and United Kingdom, and secondary markets in Canada, Australia, and Europe. Recovery messaging is multi-language and multi-timezone.",
  },
  {
    q: "How do I get support?",
    a: "Email support@rrlabs.online at any time. Live status is published on our Status page, and workspace owners receive proactive incident notifications.",
  },
];

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: `FAQ — ${BRAND.name}` },
      {
        name: "description",
        content: `Answers to the most common questions about ${BRAND.company}: how the Recovery Engine works, supported providers, security, pricing, refunds, and our Merchant of Record.`,
      },
      { property: "og:title", content: `FAQ — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Frequently asked questions about ${BRAND.company} revenue recovery.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/faq` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/faq` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }),
      },
    ],
  }),
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Frequently asked questions
        </h1>
        <p className="mt-3 text-muted-foreground">
          Everything you need before getting started. Still have questions? Email{" "}
          <a
            href="mailto:support@rrlabs.online"
            className="text-foreground underline underline-offset-4"
          >
            support@rrlabs.online
          </a>
          .
        </p>
        <dl className="mt-12 space-y-8">
          {FAQS.map((f) => (
            <div key={f.q} className="border-b border-border/60 pb-6">
              <dt className="text-lg font-medium text-foreground">{f.q}</dt>
              <dd className="mt-2 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </main>
      <MarketingFooter />
    </div>
  );
}
