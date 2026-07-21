import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Mail,
  MessageSquare,
  Plug,
  Receipt,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

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
 * Customer application navigation. Every entry points to a canonical
 * customer-facing route — no duplicates, no platform-administration
 * items. Platform Control Center features live at /platform and are
 * reached via the top-bar Platform link (super admin only).
 */
export const APP_NAV: AppNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Overview", to: "/app", icon: LayoutDashboard, keywords: ["home", "dashboard", "kpi"] },
      { id: "live-activity", label: "Recovery Events", to: "/events", icon: Activity, keywords: ["realtime", "feed", "events", "timeline", "attempts"] },
    ],
  },
  {
    id: "recovery",
    label: "Recovery",
    icon: Zap,
    items: [
      { id: "recovery-engine", label: "Recovery Engine", to: "/getting-started", icon: Zap, keywords: ["engine", "activation", "retry"] },
      { id: "recovery-strategy", label: "AI Recovery Strategy", to: "/recovery-strategy", icon: Sparkles, keywords: ["ai", "strategy", "brand voice", "automation", "policy", "rules"] },
      { id: "recovery-analytics", label: "Analytics", to: "/analytics", icon: BarChart3, keywords: ["analytics", "kpi", "revenue", "cohorts", "reports"] },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    items: [
      { id: "int-all", label: "All Integrations", to: "/integrations", icon: Plug, keywords: ["integrations", "stripe", "shopify", "paypal", "lemon", "twilio", "resend"] },
      { id: "int-whatsapp", label: "WhatsApp", to: "/integrations/whatsapp", icon: MessageSquare, keywords: ["whatsapp", "wa"] },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    items: [
      { id: "members", label: "Members & Roles", to: "/team", icon: Users, keywords: ["members", "roles", "permissions", "invitations", "workspace"] },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    items: [
      { id: "billing-statements", label: "Statements & Invoices", to: "/billing/statements", icon: Receipt, keywords: ["billing", "invoices", "statements"] },
      { id: "billing-subscription", label: "Subscription", to: "/upgrade", icon: CreditCard, keywords: ["plan", "upgrade", "subscription"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { id: "set-ai", label: "AI Settings", to: "/settings/ai", icon: Bot, keywords: ["ai", "budget", "model"] },
      { id: "set-notifications", label: "Notifications", to: "/notifications", icon: Bell, keywords: ["notifications", "alerts"] },
      { id: "set-email-prefs", label: "Email Preferences", to: "/settings/email-preferences", icon: Mail, keywords: ["email preferences", "unsubscribe"] },
      { id: "set-security", label: "Security", to: "/settings/security", icon: ShieldCheck, keywords: ["security", "sessions", "mfa"] },
      { id: "set-password", label: "Change Password", to: "/settings/change-password", icon: Lock, keywords: ["password"] },
      { id: "set-rls", label: "RLS Verification", to: "/rls-verification", icon: ScrollText, keywords: ["rls", "tenant", "verification"] },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    items: [
      { id: "sup-docs", label: "Documentation", to: "/docs", icon: FileText, keywords: ["docs"] },
      { id: "sup-help", label: "Help Center", to: "/faq", icon: LifeBuoy, keywords: ["help", "faq"] },
      { id: "sup-contact", label: "Contact Support", to: "/contact", icon: Send, keywords: ["contact"] },
      { id: "sup-status", label: "System Status", to: "/status", icon: Activity, keywords: ["status", "uptime"] },
    ],
  },
];

export function flattenAppNav(): AppNavLeaf[] {
  return APP_NAV.flatMap((g) => g.items);
}
