import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";
import { SITE_URL, BRAND } from "@/lib/brand";

export const Route = createFileRoute("/communications-policy")({
  component: CommunicationsPolicyPage,
  head: () => ({
    meta: [
      { title: `Communications Policy — ${BRAND.name}` },
      {
        name: "description",
        content: `How ${BRAND.company} uses essential service communications to operate your account, and how to manage optional marketing preferences.`,
      },
      { property: "og:title", content: `Communications Policy — ${BRAND.name}` },
      {
        property: "og:description",
        content: `Operational communications ${BRAND.company} sends to keep your account secure and running.`,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/communications-policy` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/communications-policy` }],
  }),
});

function CommunicationsPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Communications Policy" updated="July 2026">
        <p>
          This Communications Policy explains the messages {BRAND.company} ("{BRAND.name}") sends
          to account holders and authorised users. It distinguishes between{" "}
          <strong>essential service communications</strong>, which are required to operate your
          account and cannot be turned off while your account remains active, and{" "}
          <strong>optional communications</strong>, which you control from Account Settings →
          Notifications.
        </p>

        <h2>1. Essential service communications</h2>
        <p>
          By creating an account, you agree to receive the following operational communications by
          email — and, where you have provided a phone number or connected a channel, by SMS,
          WhatsApp, or in-app notification. These messages are transactional, not promotional, and
          are necessary to provide the Services, meet legal or contractual obligations, and keep
          your account and payments secure.
        </p>
        <ul>
          <li>
            <strong>Account lifecycle:</strong> email verification, welcome and onboarding
            confirmations, workspace invitations, and access changes.
          </li>
          <li>
            <strong>Authentication and security:</strong> password reset links, login verification
            codes, new device or new location sign-in alerts, suspicious activity notifications, and
            multi-factor authentication events.
          </li>
          <li>
            <strong>Billing and subscriptions:</strong> subscription confirmations, upcoming
            renewal reminders, invoices and receipts, plan changes, refunds and credits, trial
            expiry, and cancellation confirmations.
          </li>
          <li>
            <strong>Payment failures and recovery:</strong> failed payment notifications, retry
            outcomes, dunning notices, card update requests, and past-due account warnings.
          </li>
          <li>
            <strong>Product changes affecting your account:</strong> breaking API changes, planned
            deprecations, and configuration changes required to keep integrations working.
          </li>
          <li>
            <strong>Maintenance and incidents:</strong> scheduled maintenance windows, incident
            alerts, post-incident summaries, and status updates that affect your workspace.
          </li>
          <li>
            <strong>Integration and API alerts:</strong> webhook failures, connector
            re-authentication requests, expiring tokens, quota warnings, and integration health
            alerts.
          </li>
          <li>
            <strong>Compliance and legal notices:</strong> updates to the Terms of Service, Privacy
            Policy, Data Processing Addendum, and other legally required notifications, including
            data subject request confirmations and regulatory disclosures.
          </li>
          <li>
            <strong>Support responses:</strong> replies to tickets you submit and follow-ups from
            our customer support team.
          </li>
        </ul>

        <h2>2. Why you cannot opt out of essential communications</h2>
        <p>
          Essential service communications are part of the service contract. Disabling them would
          prevent us from delivering the Services safely — for example, by hiding a security alert
          on your account or by suppressing a failed-payment notification that could otherwise be
          resolved before your subscription lapses. You may close your account at any time to stop
          receiving them.
        </p>

        <h2>3. Optional communications</h2>
        <p>
          The following categories are strictly optional and default to <strong>off</strong>. You
          can turn them on or off at any time from Account Settings → Notifications:
        </p>
        <ul>
          <li>Marketing emails, product announcements, and feature highlights.</li>
          <li>Newsletters and educational content.</li>
          <li>AI feature announcements and beta invitations.</li>
          <li>WhatsApp marketing messages.</li>
          <li>SMS marketing messages.</li>
          <li>Promotional offers and partner communications.</li>
        </ul>

        <h2>4. How we send messages</h2>
        <p>
          Essential communications are sent to the primary email on your account and, where
          applicable, to channels you have explicitly connected (WhatsApp Business, verified phone
          numbers, or in-app inbox). We use vetted providers listed in our{" "}
          <a href="/privacy">Privacy Policy</a> to deliver messages and monitor deliverability.
        </p>

        <h2>5. Frequency and content controls</h2>
        <p>
          We keep the volume of essential communications to the minimum required to operate your
          account. Where a message is time-sensitive (for example, a failed payment or a security
          alert), we may send reminders until the underlying issue is resolved. Optional
          communications respect the frequency preferences you set in Account Settings.
        </p>

        <h2>6. Managing your preferences</h2>
        <p>
          Sign in and go to <strong>Account Settings → Notifications</strong> to review and change
          your optional communication preferences at any time. Unsubscribe links are included in
          every optional marketing message. If you need help, contact{" "}
          <a href="mailto:support@rrlabs.online">support@rrlabs.online</a>.
        </p>

        <h2>7. Changes to this policy</h2>
        <p>
          We may update this Communications Policy from time to time. When we do, we will post the
          updated version on this page and, where the change is material, notify you through an
          essential service communication.
        </p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
