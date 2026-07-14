import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, LineChart, MessageSquare, ShieldCheck, Zap, Lock, Layers, Workflow } from "lucide-react";
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
  }),
});

const FEATURES = [
  { icon: Bot, title: "Gemini-powered analysis", body: "Every failed payment is triaged by Gemini via the Lovable AI Gateway. It classifies the failure and drafts warm, on-brand copy per customer." },
  { icon: Workflow, title: "Multi-touch cadence", body: "Automatic follow-ups at 0h, +1 day, +3 days, and +7 days. Templates can be overridden per workspace per step." },
  { icon: MessageSquare, title: "Email + WhatsApp", body: "Send via Resend and Meta WhatsApp Cloud API. Delivery status and provider IDs are tracked per attempt." },
  { icon: LineChart, title: "Live dashboard", body: "Recovered revenue, recovery rate, at-risk amount, event stream — updated in real time as Stripe fires webhooks." },
  { icon: ShieldCheck, title: "Multi-tenant by design", body: "Organizations, workspaces, member roles, and row-level security. Every table is scoped to the right workspace." },
  { icon: Lock, title: "Encrypted credentials", body: "Provider secrets are AES-256-GCM encrypted server-side. Nothing sensitive ever reaches the browser." },
  { icon: Zap, title: "One-click connect", body: "Every integration ships with Connect, Test, Disconnect, and Health Status. Auto-verify moves the workspace to Active." },
  { icon: Layers, title: "Reusable adapters", body: "Stripe, Resend, WhatsApp Cloud today; the adapter registry lets us add gateways and channels without core changes." },
];

function FeaturesPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            The Recovery Engine, end to end.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            A production platform for subscription businesses that lose revenue to failed payments.
            Everything below ships in the box — no glue code, no external orchestration.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/auth" search={{ redirect: "/app" }}>
            <Button size="lg">
              Start recovering revenue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="outline">See pricing</Button>
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
