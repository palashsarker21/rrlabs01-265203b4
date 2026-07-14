/**
 * Loads the current viewer's AccessContext on the server.
 * Client mirrors this via useAccess().
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AccessContext } from "./types";
import { ANONYMOUS_ACCESS } from "./types";
import { PLAN_RANK, type PlanCode, type WorkspaceRole } from "./config";

function makeAuthedClient(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (isOpaque && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Public — attempts to derive access from the Authorization header
 * if present, otherwise returns ANONYMOUS_ACCESS. Never throws.
 */
export const loadAccessContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccessContext> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const authz = req?.headers.get("authorization") ?? "";
    if (!authz.startsWith("Bearer ")) return ANONYMOUS_ACCESS;
    const token = authz.slice(7);
    if (token.split(".").length !== 3) return ANONYMOUS_ACCESS;

    const supabase = makeAuthedClient(token);

    const { data: claimsData } = await supabase.auth.getClaims(token);
    const claims = claimsData?.claims;
    if (!claims?.sub) return ANONYMOUS_ACCESS;
    const userId = claims.sub;
    const email = (claims as { email?: string }).email ?? null;

    const [{ data: superAdminData }, { data: adminData }, { data: memberRow }] = await Promise.all([
      supabase.rpc("is_super_admin", { _user_id: userId }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase
        .from("workspace_members")
        .select("workspace_id, role, workspaces!inner(id, status, recovery_engine_enabled)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

    const isSuperAdmin = Boolean(superAdminData);
    const isPlatformAdmin = Boolean(adminData) || isSuperAdmin;

    let workspaceId: string | null = null;
    let workspaceRole: WorkspaceRole | null = null;
    let workspaceSuspended = false;
    let planCode: PlanCode | null = null;
    let subscriptionStatus: string | null = null;

    if (memberRow) {
      workspaceId = memberRow.workspace_id;
      workspaceRole = memberRow.role as WorkspaceRole;
      const ws = (memberRow as { workspaces?: { status?: string } }).workspaces;
      workspaceSuspended = ws?.status === "suspended";

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, plans:plan_id(code)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        subscriptionStatus = sub.status ?? null;
        const code = (sub as { plans?: { code?: string } }).plans?.code;
        if (code && code in PLAN_RANK) planCode = code as PlanCode;
      }
    }

    return {
      authenticated: true,
      userId,
      email,
      isSuperAdmin,
      isPlatformAdmin,
      workspaceId,
      workspaceRole,
      planCode,
      planRank: planCode ? PLAN_RANK[planCode] : 0,
      subscriptionStatus,
      workspaceSuspended,
      maintenanceMode: false,
    };
  },
);
