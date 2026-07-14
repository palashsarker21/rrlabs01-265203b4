import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: "Refund Policy — RRLabs" },
      { name: "description", content: "RRLabs refund terms for monthly and annual plans." },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/refund" }],
  }),
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Refund Policy" updated="July 2026">
        <p>We stand behind our product. If RRLabs isn't right for you, we'll make it right.</p>
        <h2>Monthly plans</h2>
        <p>
          Cancel any time. No pro-rated refunds; access continues through the end of the billing
          period.
        </p>
        <h2>Annual plans</h2>
        <p>
          Full refund within 14 days of purchase. After 14 days, pro-rated refund on remaining
          unused months, minus a 5% administrative fee.
        </p>
        <h2>Overages and usage</h2>
        <p>
          Usage-based charges (recovered revenue commission, message overages) are non-refundable
          once billed.
        </p>
        <h2>How to request</h2>
        <p>Email support@rrlabs.online from your workspace owner address.</p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
