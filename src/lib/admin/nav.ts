import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
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

export type AdminNavLeaf = {
  kind: "leaf";
  id: string;
  label: string;
  description?: string;
  /** Route path within the authenticated app. May point at legacy admin tab via query. */
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  keywords?: string[];
  badge?: string;
};

export type AdminNavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  items: AdminNavLeaf[];
};

export type AdminNavNode = AdminNavGroup | AdminNavLeaf;

const legacy = (tab: string): { to: string; search: Record<string, string> } => ({
  to: "/admin",
  search: { tab },
});

/**
 * Hierarchical navigation tree for the Platform Control Center (v2).
 * Leaves may deep-link into the legacy /admin tabs during the transition — no
 * existing functionality is removed. New pages will be introduced under
 * /admin/v2/* in later waves.
 */
export const ADMIN_NAV: AdminNavNode[] = [
  {
    kind: "leaf",
    id: "overview",
    label: "Overview",
    description: "Executive metrics, health, and quick actions.",
    to: "/admin/v2",
    icon: LayoutDashboard,
    keywords: ["home", "dashboard", "kpi", "executive"],
  },
  {
    kind: "group",
    id: "customers",
    label: "Customers",
    icon: Building2,
    items: [
      {
        kind: "leaf",
        id: "customers-directory",
        label: "Customer directory",
        description: "Search, filter, and manage every workspace.",
        icon: Building2,
        keywords: ["tenants", "orgs", "customers", "directory"],
        to: "/admin/v2/customers",
      },
      {
        kind: "leaf",
        id: "workspaces",
        label: "Workspaces (legacy)",
        description: "Legacy workspace table view.",
        icon: Building2,
        keywords: ["tenants", "orgs", "legacy"],
        ...legacy("workspaces"),
      },
      {
        kind: "leaf",
        id: "users",
        label: "Users & roles",
        description: "Directory, roles, impersonation.",
        icon: Users,
        keywords: ["members", "rbac", "roles", "impersonate"],
        ...legacy("users"),
      },
      {
        kind: "leaf",
        id: "support",
        label: "Support",
        description: "Tickets and conversations.",
        icon: LifeBuoy,
        keywords: ["helpdesk", "tickets", "chat"],
        ...legacy("support"),
      },
    ],
  },
  {
    kind: "group",
    id: "revenue",
    label: "Revenue",
    icon: DollarSign,
    items: [
      {
        kind: "leaf",
        id: "subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
        keywords: ["plans", "mrr", "arr"],
        ...legacy("subscriptions"),
      },
      {
        kind: "leaf",
        id: "billing",
        label: "Billing events",
        icon: Receipt,
        keywords: ["invoices", "payments"],
        ...legacy("billing"),
      },
      {
        kind: "leaf",
        id: "checkouts",
        label: "Checkout sessions",
        icon: CreditCard,
        keywords: ["lemon", "checkout"],
        ...legacy("checkouts"),
      },
      {
        kind: "leaf",
        id: "success_fee",
        label: "Success fees",
        icon: Receipt,
        keywords: ["fees", "revenue share"],
        ...legacy("success_fee"),
      },
      {
        kind: "leaf",
        id: "pricing",
        label: "Pricing config",
        icon: DollarSign,
        keywords: ["plans", "tiers"],
        ...legacy("pricing"),
      },
    ],
  },
  {
    kind: "group",
    id: "operations",
    label: "Operations",
    icon: Zap,
    items: [
      {
        kind: "leaf",
        id: "recovery",
        label: "Recovery engine",
        icon: Zap,
        keywords: ["engine", "workflow", "dunning"],
        ...legacy("recovery"),
      },
      {
        kind: "leaf",
        id: "queue",
        label: "Queue manager",
        icon: ListChecks,
        keywords: ["jobs", "workers"],
        ...legacy("queue"),
      },
      {
        kind: "leaf",
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        keywords: ["providers", "connectors"],
        ...legacy("integrations"),
      },
      {
        kind: "leaf",
        id: "webhooks",
        label: "Webhooks",
        icon: Webhook,
        keywords: ["events", "callbacks"],
        ...legacy("webhooks"),
      },
    ],
  },
  {
    kind: "group",
    id: "messaging",
    label: "Messaging",
    icon: Mail,
    items: [
      {
        kind: "leaf",
        id: "email",
        label: "Email queue",
        icon: Mail,
        keywords: ["resend", "mail"],
        ...legacy("email"),
      },
      {
        kind: "leaf",
        id: "whatsapp",
        label: "WhatsApp queue",
        icon: MessageSquare,
        keywords: ["wa", "messages"],
        ...legacy("whatsapp"),
      },
      {
        kind: "leaf",
        id: "announcements",
        label: "Announcements",
        icon: Megaphone,
        keywords: ["broadcast", "banner"],
        ...legacy("announcements"),
      },
      {
        kind: "leaf",
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        keywords: ["alerts"],
        to: "/notifications",
      },
    ],
  },
  {
    kind: "group",
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    items: [
      {
        kind: "leaf",
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        keywords: ["kpi", "metrics"],
        ...legacy("analytics"),
      },
      {
        kind: "leaf",
        id: "health",
        label: "System health",
        icon: Activity,
        keywords: ["uptime", "status"],
        ...legacy("health"),
      },
      {
        kind: "leaf",
        id: "incidents",
        label: "Incidents",
        icon: AlertTriangle,
        keywords: ["outage", "postmortem"],
        ...legacy("incidents"),
      },
      {
        kind: "leaf",
        id: "audit",
        label: "Audit log",
        icon: ScrollText,
        keywords: ["trail", "activity"],
        ...legacy("audit"),
      },
    ],
  },
  {
    kind: "group",
    id: "content",
    label: "Content",
    icon: FileText,
    items: [
      {
        kind: "leaf",
        id: "blog",
        label: "Blog CMS",
        icon: FileText,
        keywords: ["posts", "articles"],
        ...legacy("blog"),
      },
      {
        kind: "leaf",
        id: "marketplace",
        label: "Marketplace",
        icon: Sparkles,
        keywords: ["templates", "flows"],
        to: "/admin/marketplace",
      },
    ],
  },
  {
    kind: "group",
    id: "platform",
    label: "Platform",
    icon: Settings,
    items: [
      {
        kind: "leaf",
        id: "features",
        label: "Feature flags",
        icon: Sparkles,
        keywords: ["flags", "toggles"],
        ...legacy("features"),
      },
      {
        kind: "leaf",
        id: "settings",
        label: "Global settings",
        icon: Settings,
        keywords: ["config"],
        ...legacy("settings"),
      },
      {
        kind: "leaf",
        id: "apikeys",
        label: "API keys",
        icon: KeyRound,
        keywords: ["tokens", "keys"],
        ...legacy("apikeys"),
      },
      {
        kind: "leaf",
        id: "maintenance",
        label: "Maintenance",
        icon: Wrench,
        keywords: ["downtime"],
        ...legacy("maintenance"),
      },
    ],
  },
  {
    kind: "group",
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    items: [
      {
        kind: "leaf",
        id: "security",
        label: "Security center",
        icon: Lock,
        keywords: ["rls", "policies"],
        ...legacy("security"),
      },
      {
        kind: "leaf",
        id: "godmode",
        label: "God Mode",
        icon: Power,
        keywords: ["impersonate", "superuser"],
        badge: "Restricted",
        ...legacy("godmode"),
      },
      {
        kind: "leaf",
        id: "rls-verify",
        label: "RLS verification",
        icon: Gauge,
        keywords: ["tenant isolation", "policies"],
        to: "/rls-verification",
      },
    ],
  },
];

export function flattenLeaves(nodes: AdminNavNode[] = ADMIN_NAV): AdminNavLeaf[] {
  const out: AdminNavLeaf[] = [];
  for (const node of nodes) {
    if (node.kind === "leaf") out.push(node);
    else out.push(...node.items);
  }
  return out;
}
