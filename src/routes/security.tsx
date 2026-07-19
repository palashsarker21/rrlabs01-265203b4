import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { BRAND, SITE_URL, CONTACT } from "@/lib/brand";
import { buildBreadcrumbScript } from "@/lib/seo/breadcrumbs";

export const Route = createFileRoute("/security")({
  component: TrustCenterPage,
  head: () => ({
    meta: [
      { title: `Trust Center — ${BRAND.name}` },
      {
        name: "description",
        content: `${BRAND.company} Trust Center: platform security, encryption, privacy, subprocessors, responsible disclosure, and our compliance roadmap.`,
      },
      { property: "og:title", content: `Trust Center — ${BRAND.name}` },
      {
        property: "og:description",
        content: `How ${BRAND.name} protects customer revenue data — encryption, isolation, subprocessors, and responsible disclosure.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/security` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `Trust Center — ${BRAND.name}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/security` }],
    scripts: [buildBreadcrumbScript([{ name: "Trust Center", path: "/security" }])],
  }),
});

interface Subprocessor {
  name: string;
  purpose: string;
  region: string;
}

const SUBPROCESSORS: readonly Subprocessor[] = [
  { name: "Supabase", purpose: "Managed Postgres, authentication, and object storage.", region: "US / EU" },
  { name: "Cloudflare", purpose: "Edge network, DNS, DDoS protection, TLS termination.", region: "Global edge" },
  { name: "Vercel", purpose: "Static hosting and serverless deployment for the marketing site.", region: "Global edge" },
  { name: "Resend", purpose: "Transactional and lifecycle email delivery.", region: "US / EU" },
  { name: "Lemon Squeezy", purpose: "Merchant of Record — billing, invoicing, tax remittance.", region: "US" },
  { name: "Lovable AI Gateway", purpose: "LLM inference for automated recovery messaging.", region: "US / EU" },
];

function TrustCenterPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Trust Center
          </p>
          <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Security, privacy, and reliability at {BRAND.name}.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            This page is maintained by {BRAND.company} to answer the security and privacy questions
            most commonly asked by prospects, customers, and auditors. It describes controls that
            are enabled today; it is not a certification.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: July 2026</p>
        </header>

        <nav aria-label="Trust Center sections" className="mt-10 rounded-xl border border-border/60 bg-card/40 p-5">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["#platform-security", "Platform Security"],
              ["#privacy", "Privacy & Data Protection"],
              ["#encryption", "Encryption"],
              ["#infrastructure", "Infrastructure"],
              ["#subprocessors", "Subprocessors"],
              ["#disclosure", "Responsible Disclosure"],
              ["#incidents", "Incident History"],
              ["#backup-dr", "Backup & Disaster Recovery"],
              ["#compliance", "Compliance Roadmap"],
              ["#contact", "Security Contact"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prose prose-invert mt-12 max-w-none space-y-12 [&_h2]:mt-0 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          <section id="platform-security" aria-labelledby="platform-security-h">
            <h2 id="platform-security-h">Platform Security</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Row-Level Security (RLS) enforced on every tenant table. Cross-workspace reads and writes are blocked at the database, not just the application layer.</li>
              <li>Role-Based Access Control (RBAC) via a dedicated <code>user_roles</code> table and <code>has_role()</code> security-definer function — roles cannot be edited by the user they gate.</li>
              <li>Every server function that mutates data is authenticated and scoped to the caller's session; privileged operations require an explicit role check before the admin client is loaded.</li>
              <li>Webhooks (billing, email) verify HMAC signatures with a timing-safe comparison against a per-provider secret.</li>
              <li>Automated end-to-end RLS test suite (<code>run_rls_test_suite</code>) verifies cross-tenant isolation and is runnable from the in-app RLS Verification page.</li>
            </ul>
          </section>

          <section id="privacy" aria-labelledby="privacy-h">
            <h2 id="privacy-h">Privacy & Data Protection</h2>
            <p className="mt-3">
              {BRAND.company} collects only the data required to operate the Recovery Engine: your
              workspace configuration, integration credentials (encrypted), and the payment
              failure / recovery events streamed from your billing provider. We do not sell or
              share customer data.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Customer data is logically isolated per workspace via RLS.</li>
              <li>Email recipients can unsubscribe or manage preferences via HMAC-signed links; opt-outs are honored across billing and analytics categories.</li>
              <li>Audit logs record workspace-scoped state changes for accountability.</li>
              <li>See also our <a href="/privacy" className="underline">Privacy Policy</a> and <a href="/cookies" className="underline">Cookie Policy</a>.</li>
            </ul>
          </section>

          <section id="encryption" aria-labelledby="encryption-h">
            <h2 id="encryption-h">Encryption</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-foreground">In transit:</strong> TLS 1.2+ enforced end-to-end. TLS terminates at Cloudflare's edge and the connection to the origin is re-encrypted.</li>
              <li><strong className="text-foreground">At rest:</strong> Managed Postgres storage encryption via the database provider. Object storage buckets are private by default.</li>
              <li><strong className="text-foreground">Application-layer:</strong> Third-party API credentials (Stripe, Lemon Squeezy, Shopify, WhatsApp) are encrypted before persistence using AES-256-GCM with a workspace-scoped derivation.</li>
            </ul>
          </section>

          <section id="infrastructure" aria-labelledby="infrastructure-h">
            <h2 id="infrastructure-h">Infrastructure</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Application: Vercel edge / serverless deployment for the marketing site; Cloudflare Workers for server-side rendering and API endpoints.</li>
              <li>Database & Auth: Managed Postgres with Row-Level Security and per-project isolation.</li>
              <li>Edge: Cloudflare for DNS, DDoS mitigation, WAF, and TLS.</li>
              <li>CI/CD: GitHub Actions pipeline with pre-deploy validation and rollback capability.</li>
            </ul>
          </section>

          <section id="subprocessors" aria-labelledby="subprocessors-h">
            <h2 id="subprocessors-h">Subprocessors</h2>
            <p className="mt-3">
              We use the following subprocessors to deliver the service. Each is bound by its own
              data processing terms. Material changes to this list are announced in-product prior
              to taking effect.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2">Subprocessor</th>
                    <th scope="col" className="px-4 py-2">Purpose</th>
                    <th scope="col" className="px-4 py-2">Region</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.name}>
                      <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="disclosure" aria-labelledby="disclosure-h">
            <h2 id="disclosure-h">Responsible Disclosure</h2>
            <p className="mt-3">
              We welcome coordinated disclosure from the security research community. If you
              believe you have found a vulnerability, email{" "}
              <a href={`mailto:${CONTACT.supportEmail}`} className="underline">{CONTACT.supportEmail}</a>{" "}
              with steps to reproduce. We acknowledge reports within one business day and will
              keep you informed until the issue is resolved. Please avoid data exfiltration,
              service disruption, and social engineering while researching.
            </p>
          </section>

          <section id="incidents" aria-labelledby="incidents-h">
            <h2 id="incidents-h">Incident History</h2>
            <p className="mt-3">
              No reportable security incidents to date. Live service health and any active or
              recent incidents are published on our <a href="/status" className="underline">Status page</a>.
            </p>
          </section>

          <section id="backup-dr" aria-labelledby="backup-dr-h">
            <h2 id="backup-dr-h">Backup & Disaster Recovery</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Managed Postgres backups are performed by our database provider on their published cadence, with point-in-time recovery available.</li>
              <li>Application code and configuration are versioned in Git; every production deploy is reproducible from a specific commit.</li>
              <li>Infrastructure is stateless at the edge — a full region failover requires only re-pointing DNS to a healthy edge.</li>
              <li>We do not publish specific RTO / RPO figures at this time; contact us for enterprise contractual commitments.</li>
            </ul>
          </section>

          <section id="compliance" aria-labelledby="compliance-h">
            <h2 id="compliance-h">Compliance Roadmap</h2>
            <p className="mt-3">
              {BRAND.company} does not currently hold third-party security certifications. Our
              roadmap is aspirational — no dates are committed — and we will publish evidence
              (badge + audit report availability) once each is complete.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-foreground">SOC 2 Type II</strong> — planned; controls being implemented.</li>
              <li><strong className="text-foreground">ISO/IEC 27001</strong> — under evaluation.</li>
              <li><strong className="text-foreground">GDPR</strong> — we operate consistent with GDPR principles for European customers; a formal DPA is available on request.</li>
              <li><strong className="text-foreground">PCI DSS</strong> — scope minimized: card data is handled entirely by our merchant of record (Lemon Squeezy); we never touch PAN.</li>
            </ul>
          </section>

          <section id="contact" aria-labelledby="contact-h">
            <h2 id="contact-h">Security Contact</h2>
            <p className="mt-3">
              For vulnerability reports, security questionnaires, DPAs, or subprocessor inquiries,
              email <a href={`mailto:${CONTACT.supportEmail}`} className="underline">{CONTACT.supportEmail}</a>.
            </p>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
