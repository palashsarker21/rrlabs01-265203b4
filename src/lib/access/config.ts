/**
 * Centralized Access Control Layer — configuration & types.
 *
 * Every route, server function, and UI component derives its
 * permission decisions from the constants and helpers in this file.
 * Do not hardcode role / plan checks anywhere else.
 */

export type Visibility =
  | "public" // anyone (SEO indexable)
  | "authenticated" // must be signed in
  | "workspace" // must belong to the active workspace
  | "subscription" // gated by subscription plan
  | "admin" // platform admin
  | "super_admin"; // god mode

export type WorkspaceRole = "owner" | "admin" | "manager" | "member" | "viewer";
export type PlatformRole = "super_admin" | "admin";
export type PlanCode = "free" | "starter" | "growth" | "business" | "enterprise";

/** Higher number = more powerful. Used for `requiredRole` checks. */
export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 10,
  member: 20,
  manager: 30,
  admin: 40,
  owner: 50,
};

/** Higher number = higher tier. Used for `requiredPlan` checks. */
export const PLAN_RANK: Record<PlanCode, number> = {
  free: 0,
  starter: 10,
  growth: 20,
  business: 30,
  enterprise: 40,
};

/** Feature flag → minimum plan required. Single source of truth. */
export const FEATURE_MIN_PLAN = {
  basic_dashboard: "starter",
  professional_dashboard: "growth",
  advanced_analytics: "business",
  white_label: "enterprise",
  api_access: "enterprise",
  custom_workflows: "enterprise",
  multi_workspace: "growth",
  audit_log_export: "business",
  sso: "enterprise",
} satisfies Record<string, PlanCode>;

export type FeatureKey = keyof typeof FEATURE_MIN_PLAN;

/** Route access spec. */
export interface RouteAccess {
  path: string;
  visibility: Visibility;
  requiredRole?: WorkspaceRole;
  requiredPlan?: PlanCode;
  requiredFeature?: FeatureKey;
  requiresWorkspace?: boolean;
  indexable?: boolean; // SEO
  navGroup?: "marketing" | "app" | "workspace" | "admin" | "super_admin";
  label?: string;
}

/**
 * The single registry of every top-level route in the app.
 * Sitemap / RSS / nav builder / SEO helpers all read from this list.
 */
export const ROUTE_REGISTRY: RouteAccess[] = [
  // Marketing / public
  { path: "/", visibility: "public", indexable: true, navGroup: "marketing", label: "Home" },
  { path: "/features", visibility: "public", indexable: true, navGroup: "marketing", label: "Features" },
  { path: "/pricing", visibility: "public", indexable: true, navGroup: "marketing", label: "Pricing" },
  { path: "/about", visibility: "public", indexable: true, navGroup: "marketing", label: "About" },
  { path: "/contact", visibility: "public", indexable: true, navGroup: "marketing", label: "Contact" },
  { path: "/docs", visibility: "public", indexable: true, navGroup: "marketing", label: "Docs" },
  { path: "/blog", visibility: "public", indexable: true, navGroup: "marketing", label: "Blog" },
  { path: "/faq", visibility: "public", indexable: true, navGroup: "marketing", label: "FAQ" },
  { path: "/status", visibility: "public", indexable: true, label: "Status" },
  { path: "/security", visibility: "public", indexable: true, label: "Security" },
  { path: "/privacy", visibility: "public", indexable: true, label: "Privacy Policy" },
  { path: "/terms", visibility: "public", indexable: true, label: "Terms of Service" },
  { path: "/refund", visibility: "public", indexable: true, label: "Refund Policy" },
  { path: "/cookies", visibility: "public", indexable: true, label: "Cookie Policy" },
  { path: "/auth", visibility: "public", indexable: false, label: "Sign in" },

  // Authenticated app
  { path: "/app", visibility: "authenticated", indexable: false, navGroup: "app", label: "Dashboard" },
  { path: "/setup", visibility: "authenticated", indexable: false, navGroup: "app", label: "Setup" },
  { path: "/checkout", visibility: "authenticated", indexable: false, navGroup: "app", label: "Checkout" },

  // Workspace management (managers+)
  {
    path: "/app/workspace",
    visibility: "workspace",
    requiredRole: "manager",
    requiresWorkspace: true,
    indexable: false,
    navGroup: "workspace",
    label: "Workspace",
  },

  // Feature-gated
  {
    path: "/app/analytics",
    visibility: "subscription",
    requiredFeature: "advanced_analytics",
    requiresWorkspace: true,
    indexable: false,
    navGroup: "app",
    label: "Analytics",
  },
  {
    path: "/app/api-keys",
    visibility: "subscription",
    requiredFeature: "api_access",
    requiresWorkspace: true,
    indexable: false,
    navGroup: "app",
    label: "API Keys",
  },

  // Admin
  { path: "/admin", visibility: "super_admin", indexable: false, navGroup: "super_admin", label: "God Mode" },
];

export function routeAccessFor(pathname: string): RouteAccess | undefined {
  // Longest-prefix match so `/app/analytics/foo` inherits `/app/analytics`.
  return [...ROUTE_REGISTRY]
    .sort((a, b) => b.path.length - a.path.length)
    .find((r) => pathname === r.path || pathname.startsWith(r.path + "/"));
}

export function isIndexable(pathname: string): boolean {
  const r = routeAccessFor(pathname);
  if (!r) return false;
  return r.visibility === "public" && r.indexable !== false;
}

/** Helper — noindex/nofollow meta for private routes. */
export const PRIVATE_ROBOTS_META = {
  name: "robots" as const,
  content: "noindex, nofollow",
};
