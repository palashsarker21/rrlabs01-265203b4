/**
 * Pure authorization decisions. No I/O. Shared between the browser
 * (UI gating, nav filter) and the server (authorize()).
 */
import {
  FEATURE_MIN_PLAN,
  PLAN_RANK,
  WORKSPACE_ROLE_RANK,
  type FeatureKey,
  type PlanCode,
  type RouteAccess,
  type WorkspaceRole,
} from "./config";
import type { AccessContext } from "./types";

export type DenyReason =
  | "unauthenticated"
  | "forbidden"
  | "wrong_workspace"
  | "workspace_suspended"
  | "maintenance"
  | "upgrade_required";

export interface Decision {
  allowed: boolean;
  reason?: DenyReason;
  requiredPlan?: PlanCode;
  requiredRole?: WorkspaceRole;
  requiredFeature?: FeatureKey;
}

const ALLOW: Decision = { allowed: true };

export function hasPlan(ctx: AccessContext, plan: PlanCode): boolean {
  return ctx.planRank >= PLAN_RANK[plan];
}

export function hasFeature(ctx: AccessContext, feature: FeatureKey): boolean {
  if (ctx.isSuperAdmin) return true;
  return hasPlan(ctx, FEATURE_MIN_PLAN[feature]);
}

export function hasRole(ctx: AccessContext, role: WorkspaceRole): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.workspaceRole) return false;
  return WORKSPACE_ROLE_RANK[ctx.workspaceRole] >= WORKSPACE_ROLE_RANK[role];
}

/** The single decision function used by every guard. */
export function evaluate(ctx: AccessContext, spec: RouteAccess): Decision {
  if (ctx.maintenanceMode && !ctx.isSuperAdmin) {
    return { allowed: false, reason: "maintenance" };
  }

  switch (spec.visibility) {
    case "public":
      return ALLOW;
    case "authenticated":
      if (!ctx.authenticated) return { allowed: false, reason: "unauthenticated" };
      break;
    case "workspace":
      if (!ctx.authenticated) return { allowed: false, reason: "unauthenticated" };
      if (!ctx.workspaceId) return { allowed: false, reason: "wrong_workspace" };
      if (ctx.workspaceSuspended && !ctx.isSuperAdmin) {
        return { allowed: false, reason: "workspace_suspended" };
      }
      break;
    case "subscription":
      if (!ctx.authenticated) return { allowed: false, reason: "unauthenticated" };
      if (!ctx.workspaceId) return { allowed: false, reason: "wrong_workspace" };
      break;
    case "admin":
      if (!ctx.authenticated) return { allowed: false, reason: "unauthenticated" };
      if (!ctx.isPlatformAdmin && !ctx.isSuperAdmin) {
        return { allowed: false, reason: "forbidden" };
      }
      return ALLOW;
    case "super_admin":
      if (!ctx.authenticated) return { allowed: false, reason: "unauthenticated" };
      if (!ctx.isSuperAdmin) return { allowed: false, reason: "forbidden" };
      return ALLOW;
  }

  if (spec.requiresWorkspace && !ctx.workspaceId) {
    return { allowed: false, reason: "wrong_workspace" };
  }
  if (spec.requiredRole && !hasRole(ctx, spec.requiredRole)) {
    return { allowed: false, reason: "forbidden", requiredRole: spec.requiredRole };
  }
  if (spec.requiredFeature && !hasFeature(ctx, spec.requiredFeature)) {
    return {
      allowed: false,
      reason: "upgrade_required",
      requiredFeature: spec.requiredFeature,
      requiredPlan: FEATURE_MIN_PLAN[spec.requiredFeature],
    };
  }
  if (spec.requiredPlan && !hasPlan(ctx, spec.requiredPlan)) {
    return { allowed: false, reason: "upgrade_required", requiredPlan: spec.requiredPlan };
  }

  return ALLOW;
}
