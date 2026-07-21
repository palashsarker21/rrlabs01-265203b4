import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Fingerprint,
  Globe,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  Palette,
  Plug,
  Receipt,
  RefreshCw,
  Repeat,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Webhook,
  Workflow,
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
 * Enterprise navigation registry. Every leaf resolves to an existing route
 * — items without a dedicated page yet point at the nearest module (e.g.
 * "Recovery Attempts" → /events, "Invoices" → /billing/statements).
 */
export const APP_NAV: AppNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Overview", to: "/app", icon: LayoutDashboard, keywords: ["home", "dashboard", "kpi"] },
      { id: "live-activity", label: "Live Activity", to: "/events", icon: Activity, keywords: ["realtime", "feed"] },
    ],
  },
  {
    id: "recovery",
    label: "Recovery",
    icon: Zap,
    items: [
      { id: "recovery-engine", label: "Recovery Engine", to: "/getting-started", icon: Zap, keywords: ["engine", "activation"] },
      { id: "recovery-campaigns", label: "Recovery Campaigns", to: "/marketplace", icon: Target, keywords: ["campaigns"] },
      { id: "recovery-rules", label: "Recovery Rules", to: "/settings/ai", icon: ListChecks, keywords: ["rules", "automation"] },
      { id: "recovery-timeline", label: "Recovery Timeline", to: "/events", icon: CalendarClock, keywords: ["timeline"] },
      { id: "recovery-queue", label: "Recovery Queue", to: "/admin", search: { tab: "queue" }, icon: ListChecks, keywords: ["queue", "jobs"], adminOnly: true },
      { id: "recovery-attempts", label: "Recovery Attempts", to: "/events", icon: RefreshCw, keywords: ["attempts", "retries"] },
      { id: "recovery-templates", label: "Recovery Templates", to: "/marketplace", icon: FileText, keywords: ["templates"] },
      { id: "recovery-analytics", label: "Recovery Analytics", to: "/analytics", icon: BarChart3, keywords: ["analytics", "kpi"] },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    items: [
      { id: "customers-directory", label: "Customers", to: "/admin/v2/customers", icon: Users, keywords: ["customers", "directory"], adminOnly: true },
      { id: "subscriptions", label: "Subscriptions", to: "/admin", search: { tab: "subscriptions" }, icon: CreditCard, keywords: ["subs"], adminOnly: true },
      { id: "failed-payments", label: "Failed Payments", to: "/events", icon: AlertTriangle, keywords: ["failed", "declines"] },
      { id: "recovered-customers", label: "Recovered Customers", to: "/analytics", icon: UserCheck, keywords: ["recovered"] },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ShoppingBag,
    items: [
      { id: "stores", label: "Stores", to: "/integrations", icon: Store, keywords: ["stores", "shops"] },
      { id: "store-connections", label: "Store Connections", to: "/integrations", icon: Plug, keywords: ["connections"] },
      { id: "products", label: "Products", to: "/integrations", icon: ShoppingBag, keywords: ["products", "sku"] },
      { id: "checkout-events", label: "Checkout Events", to: "/events", icon: ClipboardList, keywords: ["checkout"] },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    items: [
      { id: "payment-gateways", label: "Payment Gateways", to: "/integrations", icon: CreditCard, keywords: ["stripe", "paypal", "gateway"] },
      { id: "transactions", label: "Transactions", to: "/events", icon: Receipt, keywords: ["transactions"] },
      { id: "billing-invoices", label: "Invoices", to: "/billing/statements", icon: Receipt, keywords: ["invoices", "billing"] },
      { id: "recovery-events", label: "Recovery Events", to: "/events", icon: TrendingUp, keywords: ["recovery"] },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: MessageSquare,
    items: [
      { id: "email", label: "Email", to: "/admin/email", icon: Mail, keywords: ["email", "resend"], adminOnly: true },
      { id: "whatsapp", label: "WhatsApp", to: "/integrations/whatsapp", icon: MessageSquare, keywords: ["whatsapp", "wa"] },
      { id: "sms", label: "SMS", to: "/integrations", icon: Smartphone, keywords: ["sms", "twilio"] },
      { id: "templates", label: "Templates", to: "/marketplace", icon: FileText, keywords: ["templates"] },
      { id: "delivery-logs", label: "Delivery Logs", to: "/admin/email/deliveries", icon: Send, keywords: ["delivery", "logs"], adminOnly: true },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
    items: [
      { id: "ai-providers", label: "AI Providers", to: "/admin/v2/ai", icon: Bot, keywords: ["providers", "openrouter"], adminOnly: true },
      { id: "ai-routes", label: "AI Routes", to: "/admin/v2/ai", icon: Workflow, keywords: ["routes", "routing"], adminOnly: true },
      { id: "prompt-library", label: "Prompt Library", to: "/admin/v2/ai", icon: Sparkles, keywords: ["prompts"], adminOnly: true },
      { id: "prompt-versions", label: "Prompt Versions", to: "/admin/v2/ai", icon: ScrollText, keywords: ["versions"], adminOnly: true },
      { id: "ai-analytics", label: "AI Analytics", to: "/admin/v2/ai/analytics", icon: BarChart3, keywords: ["ai", "cost", "latency"], adminOnly: true },
      { id: "ai-settings", label: "AI Settings", to: "/settings/ai", icon: Settings, keywords: ["ai", "budget"] },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Workflow,
    items: [
      { id: "workflows", label: "Workflows", to: "/marketplace", icon: Workflow, keywords: ["workflows", "flows"] },
      { id: "triggers", label: "Triggers", to: "/settings/ai", icon: Zap, keywords: ["triggers"] },
      { id: "schedules", label: "Schedules", to: "/settings/ai", icon: CalendarClock, keywords: ["schedules", "cron"] },
      { id: "retry-engine", label: "Retry Engine", to: "/getting-started", icon: Repeat, keywords: ["retries"] },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    items: [
      { id: "int-all", label: "All Integrations", to: "/integrations", icon: Plug, keywords: ["integrations"] },
      { id: "int-shopify", label: "Shopify", to: "/integrations", icon: Store, keywords: ["shopify"] },
      { id: "int-woo", label: "WooCommerce", to: "/integrations", icon: Store, keywords: ["woo"] },
      { id: "int-stripe", label: "Stripe", to: "/integrations", icon: CreditCard, keywords: ["stripe"] },
      { id: "int-paypal", label: "PayPal", to: "/integrations", icon: CreditCard, keywords: ["paypal"] },
      { id: "int-lemon", label: "Lemon Squeezy", to: "/integrations", icon: CreditCard, keywords: ["lemon"] },
      { id: "int-resend", label: "Resend", to: "/integrations", icon: Mail, keywords: ["resend"] },
      { id: "int-twilio", label: "Twilio", to: "/integrations", icon: Smartphone, keywords: ["twilio"] },
      { id: "int-whatsapp", label: "WhatsApp", to: "/integrations/whatsapp", icon: MessageSquare, keywords: ["whatsapp"] },
      { id: "api-keys", label: "API Keys", to: "/admin", search: { tab: "apikeys" }, icon: KeyRound, keywords: ["api", "keys"], adminOnly: true },
      { id: "webhooks", label: "Webhooks", to: "/admin/email/webhooks", icon: Webhook, keywords: ["webhooks"], adminOnly: true },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      { id: "an-revenue", label: "Revenue", to: "/analytics", icon: DollarSign, keywords: ["revenue", "mrr"] },
      { id: "an-recovery", label: "Recovery Performance", to: "/analytics", icon: TrendingUp, keywords: ["performance"] },
      { id: "an-funnels", label: "Funnels", to: "/analytics", icon: Target, keywords: ["funnel"] },
      { id: "an-cohorts", label: "Cohorts", to: "/analytics", icon: Users, keywords: ["cohorts"] },
      { id: "an-reports", label: "Reports", to: "/analytics", icon: FileText, keywords: ["reports"] },
      { id: "an-export", label: "Export Center", to: "/analytics", icon: ScrollText, keywords: ["export", "csv"] },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: Handshake,
    items: [
      { id: "members", label: "Members", to: "/team", icon: Users, keywords: ["members"] },
      { id: "roles", label: "Roles", to: "/team", icon: ShieldCheck, keywords: ["roles"] },
      { id: "permissions", label: "Permissions", to: "/team", icon: Lock, keywords: ["permissions"] },
      { id: "invitations", label: "Invitations", to: "/team", icon: Send, keywords: ["invitations", "invite"] },
      { id: "audit-logs", label: "Audit Logs", to: "/admin", search: { tab: "audit" }, icon: ScrollText, keywords: ["audit"], adminOnly: true },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    items: [
      { id: "sec-sessions", label: "Sessions", to: "/settings/security", icon: Fingerprint, keywords: ["sessions"] },
      { id: "sec-api", label: "API Tokens", to: "/admin", search: { tab: "apikeys" }, icon: KeyRound, keywords: ["tokens", "api"], adminOnly: true },
      { id: "sec-mfa", label: "MFA", to: "/settings/security", icon: ShieldCheck, keywords: ["mfa", "2fa"] },
      { id: "sec-activity", label: "Activity", to: "/settings/security", icon: Activity, keywords: ["activity"] },
      { id: "sec-rls", label: "RLS Verification", to: "/rls-verification", icon: Lock, keywords: ["rls", "tenant"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { id: "set-workspace", label: "Workspace", to: "/team", icon: Building2, keywords: ["workspace"] },
      { id: "set-branding", label: "Branding", to: "/team", icon: Palette, keywords: ["branding"] },
      { id: "set-notifications", label: "Notifications", to: "/notifications", icon: Bell, keywords: ["notifications"] },
      { id: "set-email-prefs", label: "Email Preferences", to: "/settings/email-preferences", icon: Mail, keywords: ["email preferences"] },
      { id: "set-billing", label: "Billing", to: "/billing/statements", icon: Receipt, keywords: ["billing"] },
      { id: "set-subscription", label: "Subscription", to: "/upgrade", icon: CreditCard, keywords: ["plan", "upgrade"] },
      { id: "set-domains", label: "Domains", to: "/integrations", icon: Globe, keywords: ["domains", "dns"] },
      { id: "set-general", label: "General", to: "/team", icon: Settings, keywords: ["general"] },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    items: [
      { id: "sup-docs", label: "Documentation", to: "/docs", icon: FileText, keywords: ["docs"] },
      { id: "sup-help", label: "Help Center", to: "/faq", icon: LifeBuoy, keywords: ["help", "faq"] },
      { id: "sup-contact", label: "Contact Support", to: "/contact", icon: MessageSquare, keywords: ["contact"] },
      { id: "sup-status", label: "System Status", to: "/status", icon: Activity, keywords: ["status", "uptime"] },
    ],
  },
];

export function flattenAppNav(): AppNavLeaf[] {
  return APP_NAV.flatMap((g) => g.items);
}
