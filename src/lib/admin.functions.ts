import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  },
  userId: string,
) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

/** Aggregated workspace overview for the admin console. Super admins only. */
export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as never, userId);
    const { data, error } = await supabase.rpc("admin_workspace_overview");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Paginated audit log listing. Super admins see everything; managers see their workspace. */
export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("audit_logs")
      .select(
        "id, workspace_id, actor_id, actor_email, action, target_type, target_id, details, ip, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Super-admin: toggle the recovery engine for any workspace. */
export const adminSetEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ workspaceId: z.string().uuid(), enabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertSuperAdmin(supabase as never, userId);

    const { error } = await supabase.rpc("admin_set_workspace_engine", {
      _workspace_id: data.workspaceId,
      _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);

    const { writeAuditLog } = await import("./audit.server");
    await writeAuditLog({
      workspaceId: data.workspaceId,
      actorId: userId,
      actorEmail: (claims as { email?: string })?.email ?? null,
      action: "admin.workspace.engine_toggled",
      targetType: "workspace",
      targetId: data.workspaceId,
      details: { enabled: data.enabled },
    });

    return { ok: true as const };
  });

/** Is the current user a super admin? Small helper the admin route uses to gate itself. */
export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { isSuperAdmin: !!data };
  });
