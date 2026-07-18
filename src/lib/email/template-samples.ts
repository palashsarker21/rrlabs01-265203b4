/**
 * Browser-safe sample data catalog for each email template.
 * Used by the admin preview page as the starting point for the JSON editor.
 * Keep this in sync with the props of the corresponding template component
 * in `src/lib/email/templates/`.
 */

export type TemplateSample = {
  name: string;
  displayName: string;
  data: Record<string, unknown>;
};

export const TEMPLATE_SAMPLES: Record<string, TemplateSample> = {
  welcome: {
    name: "welcome",
    displayName: "Welcome",
    data: { name: "Alex", ctaUrl: "https://rrlabs.online/app" },
  },
  "verify-email": {
    name: "verify-email",
    displayName: "Verify Email",
    data: {
      name: "Alex",
      verifyUrl: "https://rrlabs.online/auth/verify?token=demo",
    },
  },
  "reset-password": {
    name: "reset-password",
    displayName: "Reset Password",
    data: {
      name: "Alex",
      resetUrl: "https://rrlabs.online/auth/reset?token=demo",
    },
  },
  "invite-member": {
    name: "invite-member",
    displayName: "Invite Member",
    data: {
      workspaceName: "Acme Growth",
      inviterName: "Priya Patel",
      role: "manager",
      acceptUrl: "https://rrlabs.online/invitations/demo",
    },
  },
  "workspace-invite": {
    name: "workspace-invite",
    displayName: "Workspace Invite",
    data: {
      workspaceName: "Acme Growth",
      inviterName: "Priya Patel",
      role: "manager",
      acceptUrl: "https://rrlabs.online/invitations/demo",
    },
  },
  "trial-started": {
    name: "trial-started",
    displayName: "Trial Started",
    data: {
      name: "Alex",
      workspaceName: "Acme Growth",
      trialEndsAt: "2026-08-01",
      ctaUrl: "https://rrlabs.online/app",
    },
  },
  "trial-ending": {
    name: "trial-ending",
    displayName: "Trial Ending",
    data: {
      name: "Alex",
      workspaceName: "Acme Growth",
      daysLeft: 3,
      upgradeUrl: "https://rrlabs.online/billing",
    },
  },
  "subscription-activated": {
    name: "subscription-activated",
    displayName: "Subscription Activated",
    data: {
      name: "Alex",
      planName: "Scale",
      workspaceName: "Acme Growth",
      manageUrl: "https://rrlabs.online/billing",
    },
  },
  "payment-failed": {
    name: "payment-failed",
    displayName: "Payment Failed",
    data: {
      name: "Alex",
      workspaceName: "Acme Growth",
      amount: "$249.00",
      updateUrl: "https://rrlabs.online/billing",
      reason: "Card was declined by the issuer.",
    },
  },
  "payment-successful": {
    name: "payment-successful",
    displayName: "Payment Successful",
    data: {
      name: "Alex",
      workspaceName: "Acme Growth",
      amount: "$249.00",
      invoiceUrl: "https://rrlabs.online/billing/invoices/demo",
      period: "July 2026",
    },
  },
  "success-fee-invoice": {
    name: "success-fee-invoice",
    displayName: "Monthly Success Fee Invoice",
    data: {
      workspaceName: "Acme Growth",
      period: "July 2026",
      recoveredAmount: "$18,420.00",
      feeAmount: "$1,842.00",
      invoiceUrl: "https://rrlabs.online/billing/success-fees/demo",
    },
  },
  "weekly-analytics": {
    name: "weekly-analytics",
    displayName: "Weekly Analytics Report",
    data: {
      workspaceName: "Acme Growth",
      weekLabel: "Jul 13 – Jul 19, 2026",
      recoveredCount: 42,
      recoveredAmount: "$18,420.00",
      attempts: 156,
      dashboardUrl: "https://rrlabs.online/analytics",
    },
  },
  "recovery-summary": {
    name: "recovery-summary",
    displayName: "Recovery Summary",
    data: {
      workspaceName: "Acme Growth",
      recoveredCount: 5,
      recoveredAmount: "$1,240.00",
      window: "last 24 hours",
      dashboardUrl: "https://rrlabs.online/events",
    },
  },
  "system-alert": {
    name: "system-alert",
    displayName: "System Alert",
    data: {
      title: "Test alert",
      message: "This is a preview of a system alert email.",
      severity: "warning",
      ctaUrl: "https://rrlabs.online/app",
    },
  },
  "contact-message": {
    name: "contact-message",
    displayName: "Contact Form Message",
    data: {
      fromName: "Jane Doe",
      fromEmail: "jane@example.com",
      subject: "Question about pricing",
      message: "Hi team, could you share the Scale plan overage rates?",
    },
  },
};

export function sampleFor(name: string): TemplateSample | undefined {
  return TEMPLATE_SAMPLES[name];
}
