import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";
import { SITE_URL, BRAND, CONTACT } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: `Privacy Policy — ${BRAND.name}` },
      {
        name: "description",
        content: `How ${BRAND.company} collects, uses, discloses, and protects personal data across our platform and websites. GDPR, UK GDPR, and CCPA compliant.`,
      },
      { property: "og:title", content: `Privacy Policy — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Full privacy notice for ${BRAND.company}: data we process, lawful bases, retention, transfers, sub-processors, and your rights.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Privacy Policy" updated="July 2026">
        <p>
          {BRAND.company} ("{BRAND.name}", "we", "us", or "our") provides an enterprise AI platform
          that helps subscription and eCommerce businesses recover failed payments and reduce
          involuntary churn. This Privacy Policy explains what personal data we process, why we
          process it, how long we keep it, who we share it with, and the rights available to
          individuals under the EU General Data Protection Regulation (GDPR), the UK GDPR, the
          California Consumer Privacy Act as amended by the CPRA (CCPA/CPRA), and other applicable
          privacy laws.
        </p>
        <p>
          This policy applies to our public websites (including {SITE_URL}), the {BRAND.name}{" "}
          application, our APIs, and any related services (together, the "Services"). Where we
          process personal data on behalf of our customers, we act as a processor (or "service
          provider" under the CCPA); where we determine the purposes and means of processing (for
          example, our own account, billing, and website data), we act as a controller.
        </p>

        <h2>1. Data we process</h2>
        <p>We collect and process the following categories of personal data:</p>
        <ul>
          <li>
            <strong>Account data</strong> — name, work email, workspace and organization
            information, authentication identifiers, role, and preferences you set in the product.
          </li>
          <li>
            <strong>Billing metadata</strong> — plan, billing frequency, subscription state,
            transaction identifiers, tax information required by our Merchant of Record, and
            invoice references. Payment card details are never seen or stored by {BRAND.name}.
          </li>
          <li>
            <strong>End-customer data</strong> — contact information (such as name, email, phone,
            and language preference) and event data (such as decline reasons, amounts, retry
            outcomes, and message delivery status) provided by our customers so we can generate and
            send recovery communications on their behalf.
          </li>
          <li>
            <strong>Product usage</strong> — logs, IP address, device and browser type, session
            identifiers, and diagnostic events used to secure and improve the Services.
          </li>
          <li>
            <strong>Support and communications</strong> — messages you send to us and metadata
            about those interactions.
          </li>
        </ul>

        <h2>2. Purposes and lawful bases</h2>
        <ul>
          <li>
            <strong>Providing the Services</strong> — performance of contract with our customer.
          </li>
          <li>
            <strong>Payment recovery messaging</strong> — legitimate interests of our customer in
            recovering owed sums and preserving their customer relationship, executed under a data
            processing agreement.
          </li>
          <li>
            <strong>Billing, tax, and fraud prevention</strong> — compliance with legal
            obligations and our legitimate interests.
          </li>
          <li>
            <strong>Security, monitoring, and abuse prevention</strong> — legitimate interests in
            keeping the platform safe and reliable.
          </li>
          <li>
            <strong>Marketing communications</strong> — consent, or legitimate interests where
            permitted by applicable law (including PECR and CAN-SPAM). You may opt out at any time.
          </li>
        </ul>

        <h2>3. Merchant of Record and payments</h2>
        <p>
          Our Merchant of Record for online subscription purchases is <strong>Lemon Squeezy</strong>.
          Lemon Squeezy processes payments, calculates and remits applicable sales taxes and VAT,
          issues invoices and receipts, and handles related compliance obligations. When you
          purchase a plan, Lemon Squeezy acts as an independent controller for the payment
          transaction and is responsible for the collection and processing of your payment
          information under its own privacy notice. {BRAND.name} receives limited billing metadata
          (such as subscription identifiers, plan, status, and amounts) but does not receive or
          store full payment card numbers.
        </p>

        <h2>4. Sharing and sub-processors</h2>
        <p>
          We share personal data only with vetted sub-processors that support the Services under
          written contracts, including: cloud hosting and database infrastructure, email delivery,
          WhatsApp Business messaging, error monitoring, product analytics, and payment
          processing (Lemon Squeezy). A current list of sub-processors is available on request via{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>.
        </p>

        <h2>5. International transfers</h2>
        <p>
          Personal data may be transferred to and processed in countries other than your own,
          including the United States and the United Kingdom. Where required, transfers are
          protected by the European Commission's Standard Contractual Clauses, the UK
          International Data Transfer Addendum, or equivalent safeguards.
        </p>

        <h2>6. Retention</h2>
        <p>
          We retain account and billing data for as long as your workspace is active and for a
          reasonable period afterwards to meet legal, tax, and accounting obligations. End-customer
          contact and event data is retained only for the duration of the recovery cycle configured
          by our customer, plus a short buffer for reconciliation and audit, after which it is
          deleted or anonymized.
        </p>

        <h2>7. Your rights</h2>
        <p>
          Subject to applicable law, you have the right to access, correct, delete, restrict, or
          object to our processing of your personal data, to data portability, and to withdraw
          consent. California residents have additional rights under the CCPA/CPRA, including the
          right to know, delete, correct, and limit the use of sensitive personal information. We
          do not sell personal data and do not share personal data for cross-context behavioral
          advertising. To exercise any of these rights, email{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>. If you are an
          end-customer of one of our customers, we will forward your request to the relevant
          customer, who is the controller of your data.
        </p>

        <h2>8. Security</h2>
        <p>
          We apply administrative, technical, and organizational safeguards designed to protect
          personal data, including encryption in transit and at rest, tenant isolation via
          row-level security, least-privilege access, audit logging, and continuous monitoring.
          Learn more on our <a href="/security">Security</a> page.
        </p>

        <h2>9. Children</h2>
        <p>
          The Services are not directed to children under 16, and we do not knowingly collect
          personal data from children.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          communicated through the Services or by email. The "Last updated" date at the top of this
          page always reflects the most recent version.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions or complaints? Contact us at{" "}
          <a href={`mailto:${CONTACT.supportEmail}`}>{CONTACT.supportEmail}</a>. EU and UK
          individuals also have the right to lodge a complaint with a supervisory authority in
          their country of residence.
        </p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
