/**
 * Fine-grained permission keys for multi-tenant RBAC.
 * Must stay in sync with the `public.permissions` catalog + `role_permissions` seed.
 */
export const PERMISSIONS = {
  RECOVERY_READ: "recovery.read",
  RECOVERY_WRITE: "recovery.write",
  RECOVERY_RETRY: "recovery.retry",
  TEMPLATES_READ: "templates.read",
  TEMPLATES_WRITE: "templates.write",
  AUTOMATION_READ: "automation.read",
  AUTOMATION_WRITE: "automation.write",
  BILLING_READ: "billing.read",
  BILLING_MANAGE: "billing.manage",
  INTEGRATIONS_READ: "integrations.read",
  INTEGRATIONS_WRITE: "integrations.write",
  TEAM_READ: "team.read",
  TEAM_MANAGE: "team.manage",
  ANALYTICS_READ: "analytics.read",
  WORKSPACE_MANAGE: "workspace.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "recovery.read": "View recovery events",
  "recovery.write": "Edit recovery events",
  "recovery.retry": "Retry recovery attempts",
  "templates.read": "View templates",
  "templates.write": "Edit templates",
  "automation.read": "View automation settings",
  "automation.write": "Edit automation settings",
  "billing.read": "View billing",
  "billing.manage": "Manage billing",
  "integrations.read": "View integrations",
  "integrations.write": "Edit integrations",
  "team.read": "View team",
  "team.manage": "Manage team",
  "analytics.read": "View analytics",
  "workspace.manage": "Manage workspace",
};
