/**
 * Workspace team management: members + invitations.
 * Every function is scoped to the caller's workspace via RLS, and every
 * mutation additionally verifies the caller is owner/admin of that workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["owner", "admin", "member", "viewer"] as const;
type Role = (typeof ROLES)[number];

async function assertManager(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
  userId: string,
) {
  const { data, error } = await supabase.rpc("can_manage_workspace", {
    _workspace_id: workspaceId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You must be a workspace owner or admin.");
}


/** List members of a workspace (RLS scopes to workspaces the caller belongs to). */
export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const userIds = (members ?? []).map((m) => m.user_id);
    let profiles: Record<string, { email: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profiles[p.id] = {
          email: p.email ?? null,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      }
    }
    return (members ?? []).map((m) => ({
      ...m,
      profile: profiles[m.user_id] ?? { email: null, display_name: null, avatar_url: null },
    }));
  });

/** List invitations for a workspace (managers only via RLS). */
export const listWorkspaceInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ workspaceId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("workspace_invitations")
      .select("id, email, role, status, expires_at, created_at, token")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Create a pending invitation. Manager-only. */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().email().max(254),
        role: z.enum(ROLES).default("member"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.workspaceId, userId);

    const email = data.email.trim().toLowerCase();

    // Reject if the email already belongs to a member of the workspace.
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, profiles:user_id(email)")
      .eq("workspace_id", data.workspaceId);
    const already = (existingMember ?? []).some((m) => {
      const p = (m as { profiles?: { email?: string | null } }).profiles;
      return p?.email && p.email.toLowerCase() === email;
    });
    if (already) throw new Error("That user is already a member of this workspace.");

    const { data: inv, error } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: data.workspaceId,
        email,
        role: data.role as Role,
        invited_by: userId,
      })
      .select("id, token, email, role, expires_at, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return inv;
  });

/** Revoke a pending invitation. */
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ invitationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Change a member's role. Owner/admin only. Cannot demote the last owner. */
export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(ROLES),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, data.workspaceId, userId);

    // Prevent demoting the last owner.
    const { data: target } = await supabase
      .from("workspace_members")
      .select("id, role, user_id")
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!target) throw new Error("Member not found.");

    if (target.role === "owner" && data.role !== "owner") {
      const { count } = await supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        throw new Error("Every workspace must keep at least one owner.");
      }
    }

    const { error } = await supabase
      .from("workspace_members")
      .update({ role: data.role })
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a member. Managers or self. Cannot remove the last owner. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ workspaceId: z.string().uuid(), memberId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: target } = await supabase
      .from("workspace_members")
      .select("id, role")
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!target) throw new Error("Member not found.");

    if (target.role === "owner") {
      const { count } = await supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        throw new Error("Every workspace must keep at least one owner.");
      }
    }

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", data.memberId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Preview an invitation from its token (for the /invite/$token page). */
export const previewInvitation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ token: z.string().min(8).max(128) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("preview_workspace_invitation", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return row as {
      email: string;
      role: Role;
      status: string;
      expires_at: string;
      workspace_name: string;
      organization_name: string | null;
    };
  });

/** Accept an invitation. Requires the invited email to match the caller. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ token: z.string().min(8).max(128) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("accept_workspace_invitation", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row as { workspace_id: string; role: Role };
  });

/** Lightweight lookup used by the Team page header. */
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, slug, status")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
