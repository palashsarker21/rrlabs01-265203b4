import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Globe, Copy } from "lucide-react";
import { toast } from "sonner";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { SocialLinks } from "@/components/social-links";
import { PhoneList } from "@/components/phone-link";
import { CONTACT, SITE_URL, BRAND } from "@/lib/brand";
import { trackEvent } from "@/lib/analytics/events";
import { buildBreadcrumbScript, canonicalFor } from "@/lib/seo/breadcrumbs";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: `Contact — ${BRAND.name}` },
      {
        name: "description",
        content: `Get in touch with ${BRAND.company} about the Recovery Engine, integrations, or partnerships.`,
      },
      { property: "og:title", content: `Contact ${BRAND.name}` },
      { property: "og:description", content: `Talk to the team behind ${BRAND.name}.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalFor("/contact") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `Contact ${BRAND.name}` },
      { name: "twitter:description", content: `Talk to the team behind ${BRAND.name}.` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
    scripts: [buildBreadcrumbScript([{ name: "Contact", path: "/contact" }])],
  }),
});

async function copyText(value: string, label: string, platform: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    }
    toast.success(`${label} copied.`);
    trackEvent(platform === "email" ? "email_copy" : "website_copy", {
      component: "contact",
      platform,
    });
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}.`);
  }
}

function ContactPage() {
  const { address } = CONTACT;
  return (
    <div className="relative min-h-screen bg-background">
      <MarketingHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">Contact</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Talk to us.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Whether you&apos;re evaluating the platform, integrating a new gateway, reporting a
          security issue, or exploring a partnership — we read every message and reply from a real
          human on the team.
        </p>


        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Email</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <a
                href={`mailto:${CONTACT.supportEmail}`}
                onClick={() =>
                  trackEvent("email_click", { component: "contact", platform: "support" })
                }
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {CONTACT.supportEmail}
              </a>
              <button
                type="button"
                aria-label={`Copy ${CONTACT.supportEmail}`}
                onClick={() => void copyText(CONTACT.supportEmail, "Email", "email")}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Phone</h3>
            <PhoneList className="mt-2 text-sm text-muted-foreground" />
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur sm:col-span-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Business address</h3>
            <address className="mt-1 not-italic text-sm leading-relaxed text-muted-foreground">
              {address.line1}
              <br />
              {address.line2}
              <br />
              {address.city}, {address.region}
              <br />
              {address.country}
            </address>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50 sm:col-span-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Website</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <a
                href={CONTACT.website}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  trackEvent("website_click", { component: "contact", platform: "website" })
                }
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {CONTACT.website}
              </a>
              <button
                type="button"
                aria-label={`Copy ${CONTACT.website}`}
                onClick={() => void copyText(CONTACT.website, "Website", "website")}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <section aria-labelledby="channels" className="mt-16">
          <h2 id="channels" className="text-2xl font-semibold tracking-tight text-foreground">
            How to reach the right team
          </h2>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Sales &amp; pricing</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Enterprise plans, custom cadences, procurement, and DPAs.{" "}
                <a
                  className="text-foreground underline underline-offset-4"
                  href={`mailto:${CONTACT.supportEmail}?subject=Sales%20inquiry`}
                >
                  {CONTACT.supportEmail}
                </a>
              </dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Product support</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Account, billing, integrations, and product questions.{" "}
                <a
                  className="text-foreground underline underline-offset-4"
                  href={`mailto:${CONTACT.supportEmail}`}
                >
                  {CONTACT.supportEmail}
                </a>
              </dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Technical &amp; API</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Webhooks, adapters, SDK, and developer questions. Include workspace ID and request
                ID where possible.
              </dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Security disclosure</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Responsible disclosure and vulnerability reports.{" "}
                <a
                  className="text-foreground underline underline-offset-4"
                  href={`mailto:${CONTACT.supportEmail}?subject=Security%20disclosure`}
                >
                  {CONTACT.supportEmail}
                </a>
                . See our <a href="/security" className="underline underline-offset-4">Security page</a> for scope.
              </dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Partnerships</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Integrations, resellers, agencies, and co-marketing.
              </dd>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/40 p-5">
              <dt className="text-sm font-semibold text-foreground">Media &amp; press</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                Interviews, quotes, and briefings on payment recovery and applied AI.
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="response" className="mt-14 rounded-2xl border border-border/60 bg-card/40 p-6">
          <h2 id="response" className="text-xl font-semibold text-foreground">
            Response expectations
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Sales and product support: within one business day, Monday–Friday.</li>
            <li>Technical support with a workspace and request ID: same business day where possible.</li>
            <li>Security disclosures: acknowledged within 24 hours, triaged within 3 business days.</li>
            <li>Live platform status is published on our <a href="/status" className="underline underline-offset-4">Status page</a>.</li>
          </ul>
        </section>


        <section aria-labelledby="official-socials" className="mt-16">
          <h2
            id="official-socials"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Official social profiles
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Verified accounts. Any other profile claiming to be {BRAND.name} is not us.
          </p>
          <SocialLinks
            variant="list"
            className="mt-6"
            ariaLabel={`${BRAND.name} official social profiles`}
          />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
