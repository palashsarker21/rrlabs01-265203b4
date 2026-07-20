import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermissionKey } from "./permissions";

/**
 * Assert that `userId` has `permission` in `workspaceId`.
 * Throws a 403 Response when denied. Call from any authenticated server fn.
 */
export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  permission: PermissionKey,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _workspace_id: workspaceId,
    _permission: permission,
  });
  if (error) throw new Response(`permission check failed: ${error.message}`, { status: 500 });
  if (!data) throw new Response(`Forbidden: missing ${permission}`, { status: 403 });
}

/** Server fn: list the current user's permissions in a workspace. */
export const listMyPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("workspace_permissions_of", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (error) throw new Response(error.message, { status: 500 });
    const keys = (rows ?? []).map((r: unknown) =>
      typeof r === "string" ? r : (r as { workspace_permissions_of: string }).workspace_permissions_of,
    );
    return { permissions: keys as string[] };
  });

/** Server fn: check a single permission (edge cases where UI can't preload). */
export const checkPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; permission: string }) =>
    z.object({ workspaceId: z.string().uuid(), permission: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      _user_id: userId,
      _workspace_id: data.workspaceId,
      _permission: data.permission,
    });
    if (error) throw new Response(error.message, { status: 500 });
    return { allowed: Boolean(allowed) };
  });

/** Server fn: list all members with their effective permissions (team.manage required). */
export const listWorkspaceMembersWithPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, data.workspaceId, "team.manage");

    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("user_id, role, created_at")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Response(error.message, { status: 500 });

    const { data: overrides } = await supabase
      .from("workspace_member_permissions")
      .select("user_id, permission_key, granted")
      .eq("workspace_id", data.workspaceId);

    return {
      members: members ?? [],
      overrides: overrides ?? [],
    };
  });

/** Server fn: upsert a member permission override (team.manage required). */
export const setMemberPermissionOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      workspaceId: string;
      targetUserId: string;
      permission: string;
      granted: boolean | null;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          targetUserId: z.string().uuid(),
          permission: z.string(),
          granted: z.boolean().nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, data.workspaceId, "team.manage");

    if (data.granted === null) {
      const { error } = await supabase
        .from("workspace_member_permissions")
        .delete()
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", data.targetUserId)
        .eq("permission_key", data.permission);
      if (error) throw new Response(error.message, { status: 500 });
      return { ok: true, cleared: true };
    }

    const { error } = await supabase
      .from("workspace_member_permissions")
      .upsert(
        {
          workspace_id: data.workspaceId,
          user_id: data.targetUserId,
          permission_key: data.permission,
          granted: data.granted,
        },
        { onConflict: "workspace_id,user_id,permission_key" },
      );
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true, cleared: false };
  });
