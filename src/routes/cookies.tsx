import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
  head: () => ({
    meta: [
      { title: "Cookie Policy — RRLabs" },
      { name: "description", content: "How RRLabs uses cookies and similar technologies." },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/cookies" }],
  }),
});

function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Cookie Policy" updated="July 2026">
        <p>
          We use cookies to keep you signed in, remember preferences, and measure aggregate usage.
          We don't use third-party advertising cookies.
        </p>
        <h2>Essential</h2>
        <p>Session and CSRF cookies required for authentication.</p>
        <h2>Analytics</h2>
        <p>Anonymous, aggregated usage measurement. You can opt out from your account settings.</p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
