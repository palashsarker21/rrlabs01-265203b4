/**
 * Browser-safe email preference categories and labels.
 * NO server imports here — this module is imported from routes and
 * components. Server-only logic lives in `preferences.server.ts`.
 */

export const EMAIL_CATEGORIES = [
  "billing",
  "analytics",
  "recovery",
  "product",
  "marketing",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export type PreferenceMap = Record<EmailCategory, boolean>;

export const EMAIL_CATEGORY_LABELS: Record<
  EmailCategory,
  { label: string; description: string }
> = {
  billing: {
    label: "Billing & payments",
    description:
      "Invoices, payment receipts, monthly success-fee statements, and trial reminders.",
  },
  analytics: {
    label: "Analytics & reports",
    description: "Weekly recovery reports and recovery summary emails.",
  },
  recovery: {
    label: "Recovery activity",
    description: "Notifications about the recovery engine's activity for your workspace.",
  },
  product: {
    label: "Product updates",
    description: "Feature announcements, roadmap news, and product changelogs.",
  },
  marketing: {
    label: "Tips & offers",
    description: "Best-practice tips, guides, and occasional promotional offers.",
  },
};

export function defaultPreferences(): PreferenceMap {
  return {
    billing: true,
    analytics: true,
    recovery: true,
    product: true,
    marketing: true,
  };
}
