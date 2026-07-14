import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

const FAQS = [
  { q: "How does RRLabs recover failed payments?", a: "We connect to your billing provider, detect failed charges in real time, and send AI-personalized recovery messages across email and WhatsApp on optimal retry cadences." },
  { q: "Which payment providers are supported?", a: "Stripe, LemonSqueezy, Paddle, and any provider exposing a webhook for failed payments." },
  { q: "Do I need to write recovery copy?", a: "No. Our AI generates copy tuned to your brand voice, customer segment, and decline reason. You can edit or approve before send." },
  { q: "How fast can I go live?", a: "Most teams are live in under 15 minutes: connect your provider, verify your sender domain, enable the recovery engine." },
  { q: "Is customer data encrypted?", a: "Yes. All credentials are encrypted server-side with AES-256. Row-level security scopes every read and write to your workspace." },
  { q: "Can I cancel anytime?", a: "Yes. Plans are month-to-month. Annual plans include a pro-rated refund within 14 days." },
];

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: "FAQ — RRLabs" },
      { name: "description", content: "Frequently asked questions about RRLabs revenue recovery." },
      { property: "og:title", content: "FAQ — RRLabs" },
      { property: "og:description", content: "Frequently asked questions about RRLabs revenue recovery." },
    ],
    links: [{ rel: "canonical", href: "https://rrlabs01.lovable.app/faq" }],
    scripts: [{
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
    }],
  }),
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Frequently asked questions</h1>
        <p className="mt-3 text-muted-foreground">Everything you need before getting started.</p>
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
