/**
 * Server-side authorization helper. Every protected server function
 * that goes beyond `requireSupabaseAuth` runs its final check here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  FEATURE_MIN_PLAN,
  PLAN_RANK,
  WORKSPACE_ROLE_RANK,
  type FeatureKey,
  type PlanCode,
  type WorkspaceRole,
} from "./config";

export class AccessError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface AuthorizeOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  workspaceId?: string;
  requiredRole?: WorkspaceRole;
  requiredPlan?: PlanCode;
  requiredFeature?: FeatureKey;
  superAdminOnly?: boolean;
  platformAdminOnly?: boolean;
}

/**
 * Centralized backend authorization. Throws AccessError on deny.
 * All DB reads go through the caller's RLS-scoped supabase client.
 */
export async function authorize(opts: AuthorizeOptions) {
  const { supabase, userId } = opts;

  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSuper) return { isSuperAdmin: true as const };

  if (opts.superAdminOnly) {
    throw new AccessError("forbidden", "Super admin access required.");
  }

  if (opts.platformAdminOnly) {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new AccessError("forbidden", "Admin access required.");
    return { isSuperAdmin: false as const };
  }

  if (opts.workspaceId) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role, workspaces:workspace_id(status)")
      .eq("user_id", userId)
      .eq("workspace_id", opts.workspaceId)
      .maybeSingle();

    if (!member) throw new AccessError("wrong_workspace", "Workspace not found.", 404);
    const status = (member as { workspaces?: { status?: string } }).workspaces?.status;
    if (status === "suspended") {
      throw new AccessError("workspace_suspended", "Workspace is suspended.", 423);
    }

    if (opts.requiredRole) {
      const rank = WORKSPACE_ROLE_RANK[member.role as WorkspaceRole] ?? 0;
      if (rank < WORKSPACE_ROLE_RANK[opts.requiredRole]) {
        throw new AccessError("forbidden", "Insufficient workspace role.");
      }
    }

    const plan =
      opts.requiredPlan ??
      (opts.requiredFeature ? FEATURE_MIN_PLAN[opts.requiredFeature] : undefined);
    if (plan) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, plans:plan_id(code)")
        .eq("workspace_id", opts.workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const code = (sub as { plans?: { code?: string } } | null)?.plans?.code as
        | PlanCode
        | undefined;
      const rank = code ? (PLAN_RANK[code] ?? 0) : 0;
      if (rank < PLAN_RANK[plan]) {
        throw new AccessError("upgrade_required", `Requires ${plan} plan.`, 402);
      }
    }
  }

  return { isSuperAdmin: false as const };
}
