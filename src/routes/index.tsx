import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, LineChart, MessageSquare, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "RRLabs — AI Revenue Recovery for Subscription Businesses" },
      {
        name: "description",
        content:
          "Recover failed subscription payments automatically with AI-powered emails and WhatsApp. Connect your store in minutes.",
      },
      { property: "og:title", content: "RRLabs — AI Revenue Recovery for Subscription Businesses" },
      {
        property: "og:description",
        content: "Recover failed subscription payments automatically with AI-powered emails and WhatsApp. Connect your store in minutes.",
      },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 0%, hsl(var(--primary) / 0.15), transparent 45%), radial-gradient(circle at 85% 30%, hsl(var(--chart-3) / 0.12), transparent 50%)",
        }}
      />

      <header className="relative z-10 border-b border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" search={{ redirect: "/app" }}>
              <Button size="sm">
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            AI Revenue Recovery Platform
          </div>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Recover failed subscription payments{" "}
            <span className="bg-gradient-to-r from-primary to-[hsl(var(--chart-2))] bg-clip-text text-transparent">
              automatically
            </span>
            .
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your store, payment gateway, and messaging. RRLabs uses AI to write personalized
            recovery messages and send them the moment a payment fails — no manual work.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ redirect: "/app" }}>
              <Button size="lg">
                Start free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </Link>

          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-medium text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Revenue Recovery Labs. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Bot,
    title: "Gemini-powered",
    body: "Personalized recovery emails and WhatsApp messages, tuned per customer.",
  },
  {
    icon: MessageSquare,
    title: "Multi-channel",
    body: "Resend, SMTP, Meta WhatsApp Cloud API, and Twilio out of the box.",
  },
  {
    icon: LineChart,
    title: "Real-time",
    body: "Live dashboard: recovered revenue, recovery rate, message delivery.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "Credentials encrypted server-side. RLS, RBAC, and audit logs built-in.",
  },
];
