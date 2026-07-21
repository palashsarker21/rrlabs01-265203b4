import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";
import { SITE_URL, BRAND, CONTACT } from "@/lib/brand";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
  head: () => ({
    meta: [
      { title: `Cookie Policy — ${BRAND.name}` },
      {
        name: "description",
        content: `How ${BRAND.company} uses cookies and similar technologies on our websites and application, and how you can control them.`,
      },
      { property: "og:title", content: `Cookie Policy — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Details of cookies, their purpose, duration, and your controls.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/cookies` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/cookies` }],
  }),
});

function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Cookie Policy" updated="July 2026">
        <p>
          This Cookie Policy explains how {BRAND.company} ("{BRAND.name}", "we") uses cookies and
          similar technologies on our public websites and application. It should be read alongside
          our <a href="/privacy">Privacy Policy</a>. If you are in the EU, UK, or another
          jurisdiction that requires prior consent for non-essential cookies (including PECR and the
          EU e-Privacy Directive), we will ask for your consent before setting them.
        </p>

        <h2>1. What are cookies?</h2>
        <p>
          Cookies are small text files stored on your device by your browser. Similar technologies
          include local storage, session storage, and pixel tags. Cookies can be "first-party" (set
          by the site you are visiting) or "third-party" (set by other domains).
        </p>

        <h2>2. Categories of cookies we use</h2>
        <ul>
          <li>
            <strong>Strictly necessary</strong> — required to authenticate you, keep your session
            secure, prevent cross-site request forgery, and remember consent choices. These cannot
            be disabled without breaking core functionality.
          </li>
          <li>
            <strong>Preferences</strong> — remember your interface preferences such as theme,
            language, and workspace selection.
          </li>
          <li>
            <strong>Analytics</strong> — help us understand aggregate usage of the Services so we
            can improve performance and reliability. Data is stored in privacy-preserving form and
            never sold.
          </li>
          <li>
            <strong>Billing</strong> — cookies set by our Merchant of Record,{" "}
            <strong>Lemon Squeezy</strong>, during checkout and subscription management. These are
            necessary for the payment transaction to complete and are governed by Lemon Squeezy's
            own cookie notice.
          </li>
        </ul>

        <h2>3. Advertising</h2>
        <p>
          We do not use third-party advertising cookies, and we do not participate in cross-site
          behavioral advertising.
        </p>

        <h2>4. How to control cookies</h2>
        <p>
          You can manage or withdraw consent at any time via the cookie banner or from your account
          settings, and you can also block or delete cookies through your browser settings.
          Disabling strictly necessary cookies will prevent core features (such as signing in) from
          working.
        </p>

        <h2>5. Changes</h2>
        <p>
          We may update this Cookie Policy from time to time to reflect changes in the technologies
          we use or in applicable law. The "Last updated" date at the top of this page reflects the
          latest revision.
        </p>

        <h2>6. Contact</h2>
        <p>
          Questions about cookies? Contact{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>.
        </p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
