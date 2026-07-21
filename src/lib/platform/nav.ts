import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Bug,
  Building2,
  Cable,
  ClipboardList,
  Code2,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  FileCode,
  FileText,
  Flag,
  Gauge,
  Globe2,
  HardDrive,
  Hash,
  History,
  Image as ImageIcon,
  Inbox,
  Key,
  KeyRound,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  ListTree,
  Lock,
  LogIn,
  Mail,
  MailPlus,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Palette,
  Phone,
  Plug,
  Power,
  
  Receipt,
  RefreshCw,
  Repeat,
  ScrollText,
  Send,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Siren,
  Sliders,
  Smartphone,
  Sparkles,
  Split,
  Store,
  Terminal,
  Ticket,
  Timer,
  TrendingUp,
  Undo2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
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
  badgeKey?: string;
  godMode?: boolean;
};

export type PlatformNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: PlatformNavLeaf[];
};

// Legacy admin console tab. Any leaf that doesn't yet have a dedicated
// route falls through to /admin?tab=<slug> so no business logic is lost.
const t = (tab: string) => ({ to: "/admin", search: { tab } });

/**
 * Enterprise navigation taxonomy for the Platform Control Center.
 * Structure matches the product spec exactly; leaves point to existing
 * routes when available and to /admin?tab=… otherwise.
 */
export const PLATFORM_NAV: PlatformNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", to: "/platform", icon: LayoutDashboard, keywords: ["home", "kpi"] },
    ],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building2,
    items: [
      { id: "orgs-all", label: "All Organizations", to: "/admin/v2/customers", icon: Building2, keywords: ["workspaces", "tenants"] },
      { id: "orgs-health", label: "Organization Health", icon: Activity, keywords: ["score"], ...t("org-health") },
      { id: "orgs-provisioning", label: "Workspace Provisioning", icon: Boxes, keywords: ["provision"], ...t("provisioning") },
      { id: "orgs-usage", label: "Usage", icon: BarChart3, keywords: ["usage"], ...t("usage") },
      { id: "orgs-limits", label: "Limits", icon: Sliders, keywords: ["quota"], ...t("limits") },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: Users,
    items: [
      { id: "users-list", label: "Users", icon: Users, keywords: ["accounts"], ...t("users") },
      { id: "users-roles", label: "Roles", icon: UserCog, keywords: ["rbac"], ...t("roles") },
      { id: "users-permissions", label: "Permissions", icon: ShieldCheck, keywords: ["acl"], ...t("permissions") },
      { id: "users-sessions", label: "Sessions", icon: LogIn, keywords: ["session"], ...t("sessions") },
      { id: "users-mfa", label: "MFA", icon: ShieldCheck, keywords: ["2fa", "totp"], ...t("mfa") },
      { id: "users-invitations", label: "Invitations", icon: UserPlus, keywords: ["invite"], ...t("invitations") },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    items: [
      { id: "billing-plans", label: "Plans", icon: ListTree, keywords: ["tiers"], ...t("plans") },
      { id: "billing-pricing", label: "Pricing", icon: DollarSign, keywords: ["prices"], ...t("pricing") },
      { id: "billing-subs", label: "Subscriptions", icon: Repeat, keywords: ["mrr"], ...t("subscriptions") },
      { id: "billing-invoices", label: "Invoices", icon: Receipt, keywords: ["invoice"], ...t("invoices") },
      { id: "billing-payments", label: "Payments", icon: Wallet, keywords: ["charges"], ...t("payments") },
      { id: "billing-refunds", label: "Refunds", icon: Undo2, keywords: ["refund"], ...t("refunds") },
      { id: "billing-coupons", label: "Coupons", icon: Ticket, keywords: ["promo"], ...t("coupons") },
      { id: "billing-success-fees", label: "Success Fees", icon: Coins, keywords: ["fees"], ...t("success_fee") },
    ],
  },
  {
    id: "recovery",
    label: "Recovery",
    icon: Zap,
    items: [
      { id: "recovery-engine", label: "Recovery Engine", icon: Zap, keywords: ["engine"], ...t("recovery") },
      { id: "recovery-rules", label: "Global Rules", icon: Sliders, keywords: ["rules"], ...t("recovery-rules") },
      { id: "recovery-retries", label: "Retry Policies", icon: RefreshCw, keywords: ["retry"], ...t("retry-policies") },
      { id: "recovery-events", label: "Recovery Events", icon: Activity, keywords: ["events"], ...t("recovery-events") },
      { id: "recovery-failed", label: "Failed Jobs", icon: AlertTriangle, badgeKey: "failedJobs", ...t("failed-jobs") },
      { id: "recovery-queue", label: "Queue Manager", icon: ListChecks, badgeKey: "failedJobs", ...t("queue") },
      { id: "recovery-dlq", label: "Dead Letter Queue", icon: Archive, keywords: ["dlq"], ...t("dlq") },
    ],
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
    items: [
      { id: "ai-providers", label: "Providers", icon: Plug, keywords: ["openrouter"], ...t("ai-providers") },
      { id: "ai-models", label: "Models", icon: Bot, keywords: ["llm"], ...t("ai-models") },
      { id: "ai-routes", label: "Routes", icon: Split, keywords: ["routing"], ...t("ai-routes") },
      { id: "ai-prompts", label: "Prompt Library", icon: FileCode, keywords: ["prompt"], ...t("ai-prompts") },
      { id: "ai-usage", label: "AI Usage", to: "/admin/v2/ai/analytics", icon: BarChart3, keywords: ["tokens"] },
      { id: "ai-costs", label: "AI Costs", to: "/admin/v2/ai/analytics", icon: DollarSign, keywords: ["spend"] },
      { id: "ai-failover", label: "AI Failover", icon: ShieldAlert, keywords: ["fallback"], ...t("ai-failover") },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    icon: Send,
    items: [
      { id: "comms-email", label: "Email Queue", to: "/admin/email/deliveries", icon: Mail, badgeKey: "pendingEmails" },
      { id: "comms-whatsapp", label: "WhatsApp Queue", icon: MessageSquare, badgeKey: "pendingWhatsapp", ...t("whatsapp") },
      { id: "comms-sms", label: "SMS Queue", icon: Smartphone, keywords: ["sms"], ...t("sms") },
      { id: "comms-push", label: "Push Queue", icon: Bell, keywords: ["push"], ...t("push") },
      { id: "comms-delivery", label: "Delivery Analytics", to: "/admin/email/webhooks", icon: BarChart3, keywords: ["delivery"] },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Cable,
    items: [
      { id: "int-payments", label: "Payment Providers", icon: CreditCard, keywords: ["stripe", "lemon"], ...t("providers-payments") },
      { id: "int-stores", label: "Store Providers", icon: Store, keywords: ["shopify"], ...t("providers-stores") },
      { id: "int-email", label: "Email Providers", icon: Mail, keywords: ["resend"], ...t("providers-email") },
      { id: "int-messaging", label: "Messaging Providers", icon: MessageCircle, keywords: ["twilio"], ...t("providers-messaging") },
      { id: "int-creds", label: "API Credentials", icon: Key, keywords: ["secrets"], ...t("credentials") },
      { id: "int-webhooks", label: "Webhooks", icon: Webhook, badgeKey: "webhookFailures", ...t("webhooks") },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: Activity,
    items: [
      { id: "mon-health", label: "Platform Health", to: "/admin/v2/system-health", icon: Activity },
      { id: "mon-queue", label: "Queue Status", icon: ListChecks, badgeKey: "failedJobs", ...t("queue") },
      { id: "mon-workers", label: "Workers", icon: ServerCog, keywords: ["workers"], ...t("workers") },
      { id: "mon-cron", label: "Cron Jobs", icon: Timer, keywords: ["schedule"], ...t("cron") },
      { id: "mon-jobs", label: "Background Jobs", icon: RefreshCw, keywords: ["jobs"], ...t("bg-jobs") },
      { id: "mon-perf", label: "Performance", icon: Gauge, keywords: ["perf"], ...t("performance") },
      { id: "mon-webhooks", label: "Webhook Health", to: "/admin/email/webhooks", icon: Webhook, badgeKey: "webhookFailures" },
      { id: "mon-incidents", label: "Incidents", icon: Siren, badgeKey: "openIncidents", ...t("incidents") },
      { id: "mon-maintenance", label: "Maintenance", icon: Wrench, keywords: ["window"], ...t("maintenance") },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    items: [
      { id: "an-platform", label: "Platform", icon: BarChart3, keywords: ["platform"], ...t("analytics") },
      { id: "an-revenue", label: "Revenue", icon: DollarSign, keywords: ["mrr"], ...t("analytics-revenue") },
      { id: "an-recovery", label: "Recovery", icon: Zap, keywords: ["recovery"], ...t("analytics-recovery") },
      { id: "an-customers", label: "Customers", icon: Building2, keywords: ["customers"], ...t("analytics-customers") },
      { id: "an-growth", label: "Growth", icon: TrendingUp, keywords: ["growth"], ...t("analytics-growth") },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    items: [
      { id: "sec-audit", label: "Audit Logs", icon: ScrollText, keywords: ["audit"], ...t("audit") },
      { id: "sec-events", label: "Security Events", icon: ShieldAlert, keywords: ["events"], ...t("security-events") },
      { id: "sec-logins", label: "Login History", icon: History, keywords: ["logins"], ...t("login-history") },
      { id: "sec-secrets", label: "Secrets", icon: Lock, keywords: ["vault"], ...t("secrets") },
      { id: "sec-apikeys", label: "API Keys", icon: KeyRound, keywords: ["tokens"], ...t("apikeys") },
      { id: "sec-rate", label: "Rate Limits", icon: Gauge, keywords: ["throttle"], ...t("rate-limits") },
      { id: "sec-abuse", label: "Abuse Detection", icon: ShieldOff, keywords: ["fraud"], ...t("abuse") },
      { id: "sec-rls", label: "RLS Verification", to: "/rls-verification", icon: ShieldCheck, keywords: ["tenant"] },
    ],
  },
  {
    id: "cms",
    label: "CMS",
    icon: FileText,
    items: [
      { id: "cms-blog", label: "Blog", icon: FileText, keywords: ["posts"], ...t("blog") },
      { id: "cms-categories", label: "Categories", icon: Hash, keywords: ["taxonomy"], ...t("blog-categories") },
      { id: "cms-authors", label: "Authors", icon: UserCheck, keywords: ["writers"], ...t("blog-authors") },
      { id: "cms-media", label: "Media Library", icon: ImageIcon, keywords: ["assets"], ...t("media") },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { id: "set-global", label: "Global Settings", icon: Settings, ...t("settings") },
      { id: "set-branding", label: "Branding", icon: Palette, keywords: ["logo"], ...t("branding") },
      { id: "set-flags", label: "Feature Flags", icon: Flag, keywords: ["flags"], ...t("features") },
      { id: "set-regions", label: "Regional Settings", icon: Globe2, keywords: ["locale"], ...t("regions") },
      { id: "set-env", label: "Environment", icon: HardDrive, keywords: ["env"], ...t("environment") },
      { id: "set-notif", label: "Notification Templates", icon: Bell, keywords: ["templates"], ...t("notification-templates") },
      { id: "set-email", label: "Email Templates", to: "/admin/email", icon: MailPlus, keywords: ["email"] },
    ],
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code2,
    items: [
      { id: "dev-api", label: "API Explorer", icon: Terminal, keywords: ["api"], ...t("api-explorer") },
      { id: "dev-events", label: "Event Explorer", icon: ClipboardList, keywords: ["events"], ...t("event-explorer") },
      { id: "dev-logs", label: "Logs", icon: FileText, keywords: ["logs"], ...t("logs") },
      { id: "dev-cache", label: "Cache", icon: Boxes, keywords: ["cache"], ...t("cache") },
      { id: "dev-db", label: "Database Diagnostics", icon: Database, keywords: ["db"], ...t("db-diagnostics") },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    items: [
      { id: "sup-tickets", label: "Tickets", icon: Inbox, badgeKey: "newTickets", ...t("support") },
      { id: "sup-chat", label: "Live Chat", icon: MessageCircle, keywords: ["chat"], ...t("support-chat") },
      { id: "sup-feedback", label: "Feedback", icon: MessageSquare, keywords: ["nps"], ...t("feedback") },
    ],
  },
  {
    id: "god-mode",
    label: "God Mode",
    icon: Power,
    items: [
      { id: "godmode", label: "God Mode Console", icon: Power, keywords: ["impersonate", "superuser"], godMode: true, ...t("godmode") },
    ],
  },
];

export function flattenPlatformNav(): PlatformNavLeaf[] {
  return PLATFORM_NAV.flatMap((g) => g.items);
}
