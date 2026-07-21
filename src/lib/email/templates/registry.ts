/**
 * Registry of all transactional email templates. Each entry pairs a
 * subject-line builder with a React Email component. Templates are pure —
 * they receive typed props and render deterministic HTML.
 */

import * as React from "react";
import { Welcome } from "./welcome";
import { VerifyEmail } from "./verify-email";
import { ResetPassword } from "./reset-password";
import { InviteMember } from "./invite-member";
import { WorkspaceInvite } from "./workspace-invite";
import { TrialStarted } from "./trial-started";
import { TrialEnding } from "./trial-ending";
import { SubscriptionActivated } from "./subscription-activated";
import { PaymentFailed } from "./payment-failed";
import { PaymentSuccessful } from "./payment-successful";
import { SuccessFeeInvoice } from "./success-fee-invoice";
import { WeeklyAnalytics } from "./weekly-analytics";
import { RecoverySummary } from "./recovery-summary";
import { SystemAlert } from "./system-alert";
import { ContactMessage } from "./contact-message";

export type TemplateEntry<P> = {
  subject: (data: P) => string;
  component: React.ComponentType<P>;
  displayName: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEMPLATES: Record<string, TemplateEntry<any>> = {
  welcome: {
    subject: () => "Welcome to RRLabs",
    component: Welcome,
    displayName: "Welcome",
  },
  "verify-email": {
    subject: () => "Verify your RRLabs email",
    component: VerifyEmail,
    displayName: "Verify Email",
  },
  "reset-password": {
    subject: () => "Reset your RRLabs password",
    component: ResetPassword,
    displayName: "Reset Password",
  },
  "invite-member": {
    subject: (d: { workspaceName: string }) =>
      `You've been invited to ${d.workspaceName} on RRLabs`,
    component: InviteMember,
    displayName: "Invite Member",
  },
  "workspace-invite": {
    subject: (d: { workspaceName: string }) => `Join ${d.workspaceName} on RRLabs`,
    component: WorkspaceInvite,
    displayName: "Workspace Invite",
  },
  "trial-started": {
    subject: () => "Your 14-day RRLabs trial has started",
    component: TrialStarted,
    displayName: "Trial Started",
  },
  "trial-ending": {
    subject: (d: { daysLeft: number }) =>
      `Your RRLabs trial ends in ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"}`,
    component: TrialEnding,
    displayName: "Trial Ending",
  },
  "subscription-activated": {
    subject: (d: { planName: string }) => `Your RRLabs ${d.planName} plan is active`,
    component: SubscriptionActivated,
    displayName: "Subscription Activated",
  },
  "payment-failed": {
    subject: () => "Action required: RRLabs payment failed",
    component: PaymentFailed,
    displayName: "Payment Failed",
  },
  "payment-successful": {
    subject: () => "Payment received — RRLabs",
    component: PaymentSuccessful,
    displayName: "Payment Successful",
  },
  "success-fee-invoice": {
    subject: (d: { period: string }) => `RRLabs success fee statement — ${d.period}`,
    component: SuccessFeeInvoice,
    displayName: "Monthly Success Fee Invoice",
  },
  "weekly-analytics": {
    subject: () => "Your weekly RRLabs recovery report",
    component: WeeklyAnalytics,
    displayName: "Weekly Analytics Report",
  },
  "recovery-summary": {
    subject: () => "Recovery activity summary — RRLabs",
    component: RecoverySummary,
    displayName: "Recovery Summary",
  },
  "system-alert": {
    subject: (d: { title: string }) => `[RRLabs Alert] ${d.title}`,
    component: SystemAlert,
    displayName: "System Alert",
  },
  "contact-message": {
    subject: (d: { fromName: string }) => `New contact form message from ${d.fromName}`,
    component: ContactMessage,
    displayName: "Contact Form Message",
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function isTemplateName(v: string): v is TemplateName {
  return v in TEMPLATES;
}

export function listTemplates(): { name: string; displayName: string }[] {
  return Object.entries(TEMPLATES).map(([name, entry]) => ({
    name,
    displayName: entry.displayName,
  }));
}
