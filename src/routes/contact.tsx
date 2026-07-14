import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — RRLabs" },
      { name: "description", content: "Get in touch with the Revenue Recovery Labs team about the Recovery Engine, integrations, or partnerships." },
      { property: "og:title", content: "Contact RRLabs" },
      { property: "og:description", content: "Talk to the team behind the Recovery Engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ContactPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Talk to us.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Whether you're evaluating the platform, integrating a new gateway, or exploring a
          partnership — we'd love to hear from you.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <a
            href="mailto:hello@rrlabs.ai"
            className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50"
          >
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Email</h3>
            <p className="mt-1 text-sm text-muted-foreground">hello@rrlabs.ai</p>
          </a>
          <a
            href="mailto:sales@rrlabs.ai"
            className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50"
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Sales & partnerships</h3>
            <p className="mt-1 text-sm text-muted-foreground">sales@rrlabs.ai</p>
          </a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
