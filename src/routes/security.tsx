import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({
    meta: [
      { title: "Security — RRLabs" },
      {
        name: "description",
        content: "How RRLabs protects your data: encryption, RLS, RBAC, and compliance.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.rrlabs.online/security" }],
  }),
});

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <LegalPage title="Security" updated="July 2026">
        <p>
          RRLabs treats revenue data as the crown jewels of every business we serve. Our security
          posture reflects that.
        </p>
        <h2>Encryption</h2>
        <p>
          All customer credentials and API keys are encrypted server-side using AES-256-GCM with
          per-workspace key derivation. TLS 1.2+ is enforced end-to-end.
        </p>
        <h2>Access control</h2>
        <p>
          Row-level security scopes every database read and write. Role-based access control is
          enforced in the centralized Access Control Layer — every route, server function, and
          webhook validates workspace, role, plan, and feature before executing.
        </p>
        <h2>Compliance</h2>
        <p>
          GDPR-compliant data retention. SOC 2 Type II in progress. PCI DSS scope minimized — we
          never store raw card data.
        </p>
        <h2>Reporting a vulnerability</h2>
        <p>Email support@rrlabs.online. We respond within one business day.</p>
      </LegalPage>
      <MarketingFooter />
    </div>
  );
}
