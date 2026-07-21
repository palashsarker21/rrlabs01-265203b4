import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";
import { SITE_URL, BRAND, CONTACT } from "@/lib/brand";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: `Refund Policy — ${BRAND.name}` },
      {
        name: "description",
        content: `${BRAND.company} refund terms for monthly and annual plans, including EU/UK consumer rights and Merchant of Record handling by Lemon Squeezy.`,
      },
      { property: "og:title", content: `Refund Policy — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Full refund policy for ${BRAND.company} subscriptions.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/refund` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/refund` }],
  }),
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Refund Policy" updated="July 2026">
        <p>
          We want every customer to succeed with {BRAND.company}. This policy explains when refunds
          are available, how to request them, and how refunds are processed through our Merchant of
          Record.
        </p>

        <h2>1. Merchant of Record</h2>
        <p>
          Our Merchant of Record for subscription purchases is <strong>Lemon Squeezy</strong>. This
          means Lemon Squeezy processes your payment, issues your invoice, and, when a refund is
          approved by {BRAND.name}, returns the funds to your original payment method under its
          published billing infrastructure. Refund timelines depend on your bank or card issuer and
          typically complete within 5–10 business days.
        </p>

        <h2>2. Monthly plans</h2>
        <p>
          Monthly plans can be cancelled at any time from your workspace billing settings.
          Cancellations take effect at the end of the current billing period; the plan is not
          pro-rated. Because monthly plans are short-term commitments, we do not issue partial
          refunds for unused days once the current period has begun.
        </p>

        <h2>3. Annual plans</h2>
        <p>
          Annual plans include a <strong>14-day full refund window</strong> starting on the date of
          purchase or renewal. Within this window, you may request a full refund for any reason.
          After the 14-day window, we offer a pro-rated refund on remaining unused months, less a 5%
          administrative fee to cover payment processing and platform costs.
        </p>

        <h2>4. Statutory consumer rights (EU and UK)</h2>
        <p>
          If you are a consumer resident in the European Union or the United Kingdom, you may
          benefit from a statutory right of withdrawal for 14 days after purchase under EU Consumer
          Rights Directive 2011/83/EU and the UK Consumer Contracts Regulations 2013. By starting to
          use the Services within the 14-day period, you expressly consent to immediate performance
          and acknowledge that you may lose the right of withdrawal for the portion of the service
          already supplied. Nothing in this policy limits your statutory rights.
        </p>

        <h2>5. Usage-based charges</h2>
        <p>
          Variable and usage-based charges — including recovered revenue commissions, messaging
          overages, and one-time add-ons — are earned as they are incurred and are non-refundable
          once billed, except where required by law or where our systems clearly malfunctioned.
        </p>

        <h2>6. Chargebacks</h2>
        <p>
          Please contact us before filing a chargeback. Filing a chargeback without first attempting
          to resolve the issue may result in immediate suspension of your workspace. Legitimate
          disputes are always welcome and we will work with you to find a fair resolution.
        </p>

        <h2>7. How to request a refund</h2>
        <p>
          Email <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a> from the
          workspace owner address, including your workspace name, invoice number, and reason for the
          request. Refunds approved by {BRAND.name} are issued through Lemon Squeezy and returned to
          your original payment method.
        </p>

        <h2>8. Exceptions</h2>
        <p>
          Refunds may be declined for accounts that have breached the{" "}
          <a href="/terms">Terms of Service</a>, that have received a previous refund for the same
          subscription, or where clear evidence of fraud or abuse exists. Enterprise and custom
          agreements are governed by their signed order form.
        </p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
