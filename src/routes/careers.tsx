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
        content: `Join ${BRAND.company} and help subscription businesses stop losing revenue to failed payments. Remote-first engineering, product, design, and go-to-market roles across the US, UK, and EU.`,
      },
      { property: "og:title", content: `Careers — ${BRAND.name}` },
      { property: "og:description", content: `Open and future roles at ${BRAND.company}.` },
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
        We&apos;re a small, distributed team building the infrastructure subscription and
        eCommerce businesses rely on to recover failed payments and reduce involuntary churn. If
        payments, applied AI, and customer outcomes energize you, you&apos;ll find your people
        here.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Culture</h2>
        <p className="mt-3 text-muted-foreground">
          We work with taste and calm intensity. We ship real production software, we own the
          outcomes of our work, and we treat teammates and customers with respect. Writing is our
          most-used tool — decisions are made in shared docs, and every feature ships with a
          rationale, a metric, and a rollback plan.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">What we value</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Bias toward the outcome, not the output.</li>
          <li>Honest, kind, direct feedback — in both directions.</li>
          <li>Security and privacy as defaults, never bolt-ons.</li>
          <li>Deep work, protected calendars, and asynchronous by default.</li>
          <li>Small teams, big responsibility, short feedback loops.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Remote-first</h2>
        <p className="mt-3 text-muted-foreground">
          We are remote-first and hire across the US, UK, EU, and select time-compatible regions.
          Meetings are minimal and scheduled during a shared collaboration window. We meet in
          person a few times a year for planning, product summits, and social time.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Benefits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Competitive base salary and meaningful equity.</li>
          <li>Health, dental, and vision cover (region-appropriate stipend where not available).</li>
          <li>Flexible time off with a paid minimum, plus local public holidays.</li>
          <li>Home office and productivity budget.</li>
          <li>Learning budget for books, courses, and conferences.</li>
          <li>Parental leave for all caregivers.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Hiring process</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Intro call with the hiring manager (30 minutes).</li>
          <li>Take-home or paired working session — always paid, always time-boxed.</li>
          <li>Deep-dive interview with 2–3 teammates on domain and collaboration.</li>
          <li>Final conversation with a founder about mission fit and open questions.</li>
          <li>References and offer.</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Equal opportunity</h2>
        <p className="mt-3 text-muted-foreground">
          {BRAND.company} is an equal opportunity employer. We evaluate candidates on the merits of
          their work and their fit with our values. We welcome applications regardless of race,
          color, national origin, religion, gender, gender identity, sexual orientation, age,
          marital status, veteran status, or disability, and we will provide reasonable
          accommodations throughout the hiring process on request.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">Open roles</h2>
        <p className="mt-3 text-muted-foreground">
          We don&apos;t have any public postings right now. If you are exceptional at payments
          engineering, subscription analytics, applied AI for retention, product design, or
          go-to-market for developer-heavy SaaS, we still want to hear from you.
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Introduce yourself</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send a short note, your CV or portfolio, and a link to something you built and are proud
          of. We reply to every message.
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
