import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { BRAND, CONTACT, SITE_URL } from "@/lib/brand";

export const Route = createFileRoute("/careers")({
  component: CareersPage,
  head: () => ({
    meta: [
      { title: `Careers — ${BRAND.name}` },
      {
        name: "description",
        content: `Join ${BRAND.company} and help subscription businesses stop losing revenue to failed payments. Remote-friendly engineering, product, and go-to-market roles.`,
      },
      { property: "og:title", content: `Careers — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Open roles at ${BRAND.company}.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/careers` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/careers` }],
  }),
});

function CareersPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back home
      </Link>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Careers at {BRAND.name}
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        We are a small, distributed team building the infrastructure subscription businesses rely
        on to recover failed payments and reduce involuntary churn.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Open roles</h2>
        <p className="mt-3 text-muted-foreground">
          We don&apos;t have any public postings right now. If you are exceptional at payments
          engineering, subscription analytics, or applied AI for retention, we still want to hear
          from you.
        </p>
      </section>

      <section className="mt-12 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Introduce yourself</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send a short note, your CV or portfolio, and a link to something you built.
        </p>
        <a
          href={`mailto:${CONTACT.supportEmail}?subject=Careers%20at%20${encodeURIComponent(BRAND.name)}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Mail className="h-4 w-4" /> {CONTACT.supportEmail}
        </a>
      </section>
    </main>
  );
}
