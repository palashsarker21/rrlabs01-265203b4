import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BRAND, SITE_URL } from "@/lib/brand";

export const Route = createFileRoute("/docs/api")({
  component: ApiDocsPage,
  head: () => ({
    meta: [
      { title: `API Documentation — ${BRAND.name}` },
      {
        name: "description",
        content: `Reference for the ${BRAND.name} public API — webhooks, recovery events, and integration endpoints.`,
      },
      { property: "og:title", content: `API Documentation — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Reference for the ${BRAND.name} public API.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/docs/api` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/docs/api` }],
  }),
});

const ENDPOINTS: {
  method: "GET" | "POST";
  path: string;
  auth: "none" | "signature";
  summary: string;
}[] = [
  {
    method: "GET",
    path: "/api/public/health",
    auth: "none",
    summary: "Liveness probe. Returns HTTP 200 with a JSON status payload.",
  },
  {
    method: "POST",
    path: "/api/public/webhooks/stripe",
    auth: "signature",
    summary:
      "Receives Stripe webhook events. Requires a valid Stripe-Signature header. Handles payment_intent, invoice, and subscription events.",
  },
  {
    method: "POST",
    path: "/api/public/webhooks/lemonsqueezy",
    auth: "signature",
    summary:
      "Receives Lemon Squeezy webhook events. Requires a valid X-Signature header signed with your webhook secret.",
  },
  {
    method: "POST",
    path: "/api/public/webhooks/{provider}/{integrationId}",
    auth: "signature",
    summary:
      "Generic provider webhook endpoint. Verifies the signature against the integration's stored secret before routing to the recovery engine.",
  },
  {
    method: "POST",
    path: "/api/public/hooks/recovery-cadence",
    auth: "signature",
    summary:
      "Cron endpoint used by the scheduler to advance recovery cadences. Requires the shared cron secret.",
  },
];

function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link
        to="/docs"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All documentation
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        {BRAND.name} API
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Public endpoints for webhooks, scheduled jobs, and health checks. Application data is
        accessed through the authenticated dashboard; only integration and platform endpoints are
        documented here.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Base URL</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
          <code>{SITE_URL}</code>
        </pre>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Authentication</h2>
        <p className="mt-3 text-muted-foreground">
          Webhook endpoints authenticate every request using an HMAC signature signed with the
          provider&apos;s webhook secret. Requests with missing or invalid signatures are rejected
          with HTTP 401. There is no bearer-token API surface on the public endpoints.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Endpoints</h2>
        <div className="mt-4 space-y-3">
          {ENDPOINTS.map((e) => (
            <article
              key={`${e.method} ${e.path}`}
              className="rounded-xl border border-border/70 bg-card p-4"
            >
              <header className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  {e.method}
                </span>
                <code className="font-mono text-sm text-foreground">{e.path}</code>
                <span className="ml-auto rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  auth: {e.auth}
                </span>
              </header>
              <p className="mt-2 text-sm text-muted-foreground">{e.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Rate limits</h2>
        <p className="mt-3 text-muted-foreground">
          Webhook endpoints accept the full volume dispatched by the upstream provider. The cron
          endpoint is rate-limited to one call every 60 seconds per workspace.
        </p>
      </section>
    </main>
  );
}
