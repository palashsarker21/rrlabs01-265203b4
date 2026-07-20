import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermissionKey } from "./permissions";

/**
 * Assert that the caller has `permission` in `workspaceId`.
 * Throws a 403-style Response when denied. Call from any authenticated server fn.
 */
export async function requirePermission(
  supabase: NonNullable<Parameters<Parameters<typeof createServerFn>[0] extends never ? never : any>[0]> extends never
    ? any
    : any,
  workspaceId: string,
  permission: PermissionKey,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: (await supabase.auth.getUser()).data.user?.id,
    _workspace_id: workspaceId,
    _permission: permission,
  });
  if (error) throw new Response(`permission check failed: ${error.message}`, { status: 500 });
  if (!data) throw new Response(`Forbidden: missing ${permission}`, { status: 403 });
}

/**
 * Server fn: list the current user's permissions in a workspace.
 * The client hook `usePermissions` calls this.
 */
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

/**
 * Server fn: check a single permission (used for edge cases where UI can't preload).
 */
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
