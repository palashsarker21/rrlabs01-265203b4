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
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Talk to us.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Whether you're evaluating the platform, integrating a new gateway, or exploring a
          partnership — we'd love to hear from you.
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
