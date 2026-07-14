import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — RRLabs" },
      { name: "description", content: "Terms governing the use of Revenue Recovery Labs." },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/terms" }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Terms of Service" updated="July 2026">
        <p>By using RRLabs you agree to these terms. If you don't agree, don't use the service.</p>
        <h2>Service</h2>
        <p>
          RRLabs provides an automated revenue recovery platform. We are not a payment processor and
          do not hold funds.
        </p>
        <h2>Acceptable use</h2>
        <p>
          No spam, no unlawful messaging, no bypassing carrier or provider policies. Compliance with
          CAN-SPAM, GDPR, and WhatsApp Business policy is your responsibility.
        </p>
        <h2>Fees</h2>
        <p>
          Plans are billed monthly or annually in advance. Overages are billed monthly in arrears.
        </p>
        <h2>Termination</h2>
        <p>Either party may terminate for material breach with 30 days' notice.</p>
        <h2>Liability</h2>
        <p>Our aggregate liability is capped at fees paid in the preceding 12 months.</p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
