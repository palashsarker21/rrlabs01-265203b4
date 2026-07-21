import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  Plug,
  Power,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  Wrench,
  Zap,
} from "lucide-react";

export type PlatformNavLeaf = {
  id: string;
  label: string;
  description?: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  keywords?: string[];
  /** Optional key into the live badges map (see badges.functions). */
  badgeKey?: string;
  /** Restricted to super_admin AND the founder email. */
  godMode?: boolean;
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: PlatformNavLeaf[];
};

const legacy = (tab: string) => ({ to: "/admin", search: { tab } });

/**
 * Module-based navigation registry for the Platform Control Center.
 * Every leaf points to an existing route so no functionality is lost;
 * new pages replace legacy /admin?tab= links over time.
 */
export const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      {
        id: "home",
        label: "Dashboard",
        to: "/platform",
        icon: LayoutDashboard,
        keywords: ["home", "kpi", "executive"],
      },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: Activity,
    items: [
      {
        id: "health",
        label: "Platform Health",
        to: "/admin/v2/system-health",
        icon: Activity,
        keywords: ["uptime", "status", "diagnostics"],
      },
      {
        id: "queue",
        label: "Queue Status",
        icon: ListChecks,
        keywords: ["jobs", "queue"],
        badgeKey: "failedJobs",
        ...legacy("queue"),
      },
      {
        id: "incidents",
        label: "Incidents",
        icon: AlertTriangle,
        keywords: ["outage"],
        badgeKey: "openIncidents",
        ...legacy("incidents"),
      },
      {
        id: "webhooks",
        label: "Webhooks",
        icon: Webhook,
        keywords: ["webhooks"],
        badgeKey: "webhookFailures",
        ...legacy("webhooks"),
      },
      {
        id: "audit",
        label: "Audit Log",
        icon: ScrollText,
        keywords: ["audit", "trail"],
        ...legacy("audit"),
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Building2,
    items: [
      {
        id: "customers-directory",
        label: "Organizations",
        to: "/admin/v2/customers",
        icon: Building2,
        keywords: ["workspaces", "tenants", "orgs"],
      },
      {
        id: "users",
        label: "Users & Roles",
        icon: Users,
        keywords: ["users", "rbac"],
        ...legacy("users"),
      },
      {
        id: "support",
        label: "Support",
        icon: LifeBuoy,
        keywords: ["tickets"],
        badgeKey: "newTickets",
        ...legacy("support"),
      },
    ],
  },
  {
    id: "revenue",
    label: "Revenue",
    icon: DollarSign,
    items: [
      {
        id: "subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
        keywords: ["mrr"],
        ...legacy("subscriptions"),
      },
      {
        id: "billing",
        label: "Billing Events",
        icon: Receipt,
        keywords: ["invoices", "payments"],
        ...legacy("billing"),
      },
      {
        id: "checkouts",
        label: "Checkouts",
        icon: CreditCard,
        keywords: ["lemon"],
        ...legacy("checkouts"),
      },
      {
        id: "success_fee",
        label: "Success Fees",
        icon: Receipt,
        keywords: ["fees"],
        ...legacy("success_fee"),
      },
      {
        id: "pricing",
        label: "Pricing",
        icon: DollarSign,
        keywords: ["plans"],
        ...legacy("pricing"),
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Zap,
    items: [
      {
        id: "recovery",
        label: "Recovery Engine",
        icon: Zap,
        keywords: ["recovery"],
        ...legacy("recovery"),
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        keywords: ["providers"],
        ...legacy("integrations"),
      },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: Mail,
    items: [
      {
        id: "email",
        label: "Email",
        to: "/admin/email",
        icon: Mail,
        keywords: ["resend"],
        badgeKey: "pendingEmails",
      },
      {
        id: "deliveries",
        label: "Deliveries",
        to: "/admin/email/deliveries",
        icon: Mail,
        keywords: ["delivery"],
      },
      {
        id: "email-webhooks",
        label: "Email Webhooks",
        to: "/admin/email/webhooks",
        icon: Webhook,
        keywords: ["resend", "webhooks"],
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        icon: MessageSquare,
        keywords: ["wa"],
        badgeKey: "pendingWhatsapp",
        ...legacy("whatsapp"),
      },
      {
        id: "announcements",
        label: "Announcements",
        icon: Megaphone,
        keywords: ["broadcast"],
        ...legacy("announcements"),
      },
      {
        id: "notifications",
        label: "Notifications",
        to: "/notifications",
        icon: Bell,
        keywords: ["alerts"],
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
    items: [
      {
        id: "ai-config",
        label: "AI Configuration",
        to: "/admin/v2/ai",
        icon: Bot,
        keywords: ["providers", "routes", "prompts"],
      },
      {
        id: "ai-analytics",
        label: "AI Analytics",
        to: "/admin/v2/ai/analytics",
        icon: BarChart3,
        keywords: ["cost", "latency"],
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    items: [
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        keywords: ["kpi"],
        ...legacy("analytics"),
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
    items: [
      {
        id: "blog",
        label: "Blog CMS",
        icon: FileText,
        keywords: ["posts"],
        ...legacy("blog"),
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    icon: Settings,
    items: [
      {
        id: "features",
        label: "Feature Flags",
        icon: Sparkles,
        keywords: ["flags"],
        ...legacy("features"),
      },
      {
        id: "settings",
        label: "Global Settings",
        icon: Settings,
        keywords: ["config"],
        ...legacy("settings"),
      },
      {
        id: "apikeys",
        label: "API Keys",
        icon: KeyRound,
        keywords: ["tokens"],
        ...legacy("apikeys"),
      },
      {
        id: "maintenance",
        label: "Maintenance",
        icon: Wrench,
        keywords: ["downtime"],
        ...legacy("maintenance"),
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    items: [
      {
        id: "security",
        label: "Security Center",
        icon: Lock,
        keywords: ["rls"],
        ...legacy("security"),
      },
      {
        id: "rls-verify",
        label: "RLS Verification",
        to: "/rls-verification",
        icon: Gauge,
        keywords: ["tenant"],
      },
    ],
  },
  {
    id: "god-mode",
    label: "God Mode",
    icon: Power,
    items: [
      {
        id: "godmode",
        label: "God Mode Console",
        icon: Power,
        keywords: ["impersonate", "superuser"],
        godMode: true,
        ...legacy("godmode"),
      },
    ],
  },
];

export function flattenPlatformNav(): PlatformNavLeaf[] {
  return PLATFORM_NAV.flatMap((g) => g.items);
}
