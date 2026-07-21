import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";
import { SITE_URL, BRAND, CONTACT } from "@/lib/brand";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: `Terms of Service — ${BRAND.name}` },
      {
        name: "description",
        content: `The terms governing the use of ${BRAND.company} services, subscriptions, billing through our Merchant of Record, acceptable use, and liability.`,
      },
      { property: "og:title", content: `Terms of Service — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Master terms for using ${BRAND.company}.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/terms` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Terms of Service" updated="July 2026">
        <p>
          These Terms of Service ("Terms") govern your access to and use of the {BRAND.company} ("
          {BRAND.name}") platform, websites, and APIs (together, the "Services"). By creating an
          account, subscribing to a plan, or otherwise using the Services, you agree to be bound by
          these Terms. If you are entering into these Terms on behalf of an organization, you
          represent that you have authority to bind that organization.
        </p>

        <h2>1. The Services</h2>
        <p>
          {BRAND.name} provides an automated revenue recovery platform that connects to your payment
          provider, classifies failed transactions, generates personalized recovery communications,
          and dispatches them across email, WhatsApp, and other supported channels. We are a
          software provider. We are not a payment processor, a bank, or a money transmitter, and we
          do not hold customer funds.
        </p>

        <h2>2. Accounts and eligibility</h2>
        <p>
          You must be at least 18 years old and legally capable of entering into contracts. You are
          responsible for maintaining the confidentiality of your credentials and for all activity
          under your account. Notify us immediately at{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a> if you suspect
          unauthorized access.
        </p>

        <h2>3. Subscriptions, fees, and Merchant of Record</h2>
        <p>
          Subscription plans and prices are described on the <a href="/pricing">Pricing</a> page.
          Our Merchant of Record for online purchases is <strong>Lemon Squeezy</strong>. This means
          that:
        </p>
        <ul>
          <li>Payments are securely processed by Lemon Squeezy.</li>
          <li>
            Applicable sales taxes, VAT, and GST are calculated and collected by Lemon Squeezy where
            required.
          </li>
          <li>Invoices and receipts are issued through Lemon Squeezy.</li>
          <li>
            Subscription management (renewals, cancellations, payment method changes) follows Lemon
            Squeezy's billing infrastructure.
          </li>
          <li>
            Refunds are handled in accordance with our <a href="/refund">Refund Policy</a>.
          </li>
          <li>{BRAND.name} does not directly store your payment card information.</li>
        </ul>
        <p>
          Plans renew automatically for the same term at the then-current price unless cancelled
          before the renewal date. Usage-based charges (for example, recovered revenue commissions
          or messaging overages) are billed monthly in arrears where applicable.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to use the Services to:</p>
        <ul>
          <li>
            Send unsolicited bulk messages or content that violates applicable anti-spam or
            telecommunications law (including CAN-SPAM, PECR, and the EU e-Privacy Directive);
          </li>
          <li>
            Violate WhatsApp Business Policy, carrier policies, or any provider terms of service;
          </li>
          <li>Infringe intellectual property, privacy, or other rights of third parties;</li>
          <li>
            Attempt to reverse engineer, disrupt, or gain unauthorized access to the Services;
          </li>
          <li>
            Process special categories of personal data outside the intended purpose of recovery
            messaging without a lawful basis and appropriate safeguards.
          </li>
        </ul>
        <p>
          Compliance with applicable law for messages you send through the Services is your
          responsibility as the sender of record.
        </p>

        <h2>5. Customer data and privacy</h2>
        <p>
          You retain all rights in the data you provide to the Services ("Customer Data"). You grant{" "}
          {BRAND.name} a limited, non-exclusive license to process Customer Data solely to provide,
          secure, and improve the Services. Our processing is governed by the{" "}
          <a href="/privacy">Privacy Policy</a> and, where applicable, our Data Processing
          Agreement.
        </p>

        <h2>6. Availability and support</h2>
        <p>
          We use commercially reasonable efforts to keep the Services available and performant.
          Real-time status is published on our <a href="/status">Status page</a>. Standard support
          is available via <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>{" "}
          during business hours; higher tiers may include enhanced response times.
        </p>

        <h2>7. Suspension and termination</h2>
        <p>
          Either party may terminate the subscription for material breach with 30 days' prior
          written notice, provided the breach remains uncured. We may suspend the Services
          immediately if required by law, in response to a serious security event, or if your use
          poses a risk to the platform or its users.
        </p>

        <h2>8. Warranty disclaimers</h2>
        <p>
          Except as expressly provided in these Terms, the Services are provided "as is" and "as
          available" without warranties of any kind, whether express, implied, or statutory,
          including merchantability, fitness for a particular purpose, and non-infringement. We do
          not guarantee any specific recovery rate, revenue outcome, or deliverability result.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, neither party will be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, revenue, or
          data. Our aggregate liability arising out of or relating to the Services is capped at the
          fees you paid to {BRAND.name} in the twelve (12) months immediately preceding the event
          giving rise to the claim.
        </p>

        <h2>10. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws applicable at the seat of {BRAND.company}, without
          regard to conflict-of-laws principles. Where mandatory consumer protection laws in your
          country of residence apply, nothing in these Terms limits those rights.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may modify these Terms from time to time. Material changes will be communicated through
          the Services or by email at least 30 days in advance. Continued use after the effective
          date constitutes acceptance.
        </p>

        <h2>12. Contact</h2>
        <p>
          Legal notices should be sent to{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>.
        </p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
