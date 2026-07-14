import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, Phone, MapPin, Globe } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { CONTACT, SITE_URL, BRAND } from "@/lib/brand";

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
      { property: "og:url", content: `${SITE_URL}/contact` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
});

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
          <a
            href={`mailto:${CONTACT.supportEmail}`}
            className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50"
          >
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Email</h3>
            <p className="mt-1 text-sm text-muted-foreground">{CONTACT.supportEmail}</p>
          </a>
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Phone</h3>
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {CONTACT.phones.map((p) => (
                <li key={p}>
                  <a href={`tel:${p}`} className="hover:text-foreground">
                    {p}
                  </a>
                </li>
              ))}
            </ul>
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
          <a
            href={CONTACT.website}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur transition hover:border-primary/50 sm:col-span-2"
          >
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold text-foreground">Website</h3>
            <p className="mt-1 text-sm text-muted-foreground">{CONTACT.website}</p>
          </a>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
