import type { LucideIcon } from "lucide-react";
import { BarChart3, CreditCard, LayoutDashboard, Plug, Users } from "lucide-react";

export type AppNavLeaf = {
  id: string;
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  keywords?: string[];
  badge?: string;
  adminOnly?: boolean;
};

export type AppNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AppNavLeaf[];
  adminOnly?: boolean;
};

/**
 * Customer application navigation — exactly 5 top-level modules.
 * Every other page (Settings, Support, Recovery Engine, Notifications,
 * RLS Verification, etc.) is reachable via the top-bar user menu and
 * in-page links only. No duplication in the sidebar or command palette.
 */
export const APP_NAV: AppNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      {
        id: "overview",
        label: "Overview",
        to: "/app",
        icon: LayoutDashboard,
        keywords: ["home", "dashboard", "summary", "kpi"],
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      {
        id: "analytics",
        label: "Analytics",
        to: "/analytics",
        icon: BarChart3,
        keywords: [
          "analytics",
          "revenue",
          "recovery",
          "funnels",
          "reports",
          "performance",
          "exports",
          "customers",
          "results",
        ],
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    items: [
      {
        id: "integrations",
        label: "Integrations",
        to: "/integrations",
        icon: Plug,
        keywords: [
          "integrations",
          "shopify",
          "woocommerce",
          "stripe",
          "paypal",
          "lemon",
          "twilio",
          "resend",
          "whatsapp",
        ],
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    items: [
      {
        id: "team",
        label: "Team",
        to: "/team",
        icon: Users,
        keywords: ["members", "roles", "permissions", "invitations", "workspace"],
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    items: [
      {
        id: "billing",
        label: "Billing",
        to: "/billing/statements",
        icon: CreditCard,
        keywords: ["billing", "invoices", "statements", "subscription", "plan", "upgrade"],
      },
    ],
  },
];

export function flattenAppNav(): AppNavLeaf[] {
  return APP_NAV.flatMap((g) => g.items);
}
