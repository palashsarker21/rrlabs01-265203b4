import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — RRLabs" },
      { name: "description", content: "How Revenue Recovery Labs collects, uses, and protects your data." },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/privacy" }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Privacy Policy" updated="July 2026">
        <p>Revenue Recovery Labs ("RRLabs", "we") processes personal data on behalf of our customers to recover failed subscription payments. This policy describes what we collect, why, and your rights.</p>
        <h2>Data we process</h2>
        <p>Account data (name, email, workspace), billing metadata (subscription IDs, decline reasons, amounts), and end-customer contact data provided by our customers for recovery messaging.</p>
        <h2>Purpose</h2>
        <p>To provide the RRLabs recovery service, generate personalized recovery messages, and produce analytics for our customers.</p>
        <h2>Retention</h2>
        <p>End-customer data is retained only as long as needed to complete the recovery cycle, then deleted per our data retention policy.</p>
        <h2>Your rights</h2>
        <p>Access, correction, deletion, and portability under GDPR/CCPA. Contact support@rrlabs.online.</p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
