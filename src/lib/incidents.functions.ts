/**
 * Incident Management — server functions.
 *
 * Public reads use the publishable-key client (RLS filters to is_public = true).
 * Super admins create/update incidents and append status-timeline updates.
 * Every mutation writes an immutable audit log entry.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
const IMPACTS = ["none", "minor", "major", "critical"] as const;
export type IncidentStatus = (typeof STATUSES)[number];
export type IncidentImpact = (typeof IMPACTS)[number];

export type PublicIncident = {
  id: string;
  title: string;
  summary: string | null;
  status: IncidentStatus;
  impact: IncidentImpact;
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  updates: {
    id: string;
    status: IncidentStatus;
    message: string;
    created_at: string;
  }[];
};

function makePublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (isOpaque && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function assertSuperAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (
      fn: "is_super_admin",
      args: { _user_id: string },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await sb.rpc("is_super_admin", { _user_id: context.userId });
  if (error) throw new Error((error as Error).message ?? "Authorization failed.");
  if (!data) throw new Error("Super admin access required.");
}

async function audit(
  context: { userId: string; claims: unknown },
  action: string,
  details: Record<string, unknown>,
  targetId?: string,
) {
  const { writeAuditLog } = await import("./audit.server");
  await writeAuditLog({
    actorId: context.userId,
    actorEmail: (context.claims as { email?: string })?.email ?? null,
    action,
    targetType: "incident",
    targetId: targetId ?? null,
    details,
  });
}

/** Public — list recent incidents with their update timeline. */
export const listPublicIncidents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicIncident[]> => {
    const supabase = makePublicClient();
    const { data: incidents, error } = await supabase
      .from("incidents")
      .select(
        "id, title, summary, status, impact, affected_components, started_at, resolved_at, created_at, updated_at",
      )
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("[incidents] list failed", error.message);
      return [];
    }
    const rows = incidents ?? [];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id as string);
    const { data: updates } = await supabase
      .from("incident_updates")
      .select("id, incident_id, status, message, created_at")
      .in("incident_id", ids)
      .order("created_at", { ascending: false });
    const byIncident = new Map<string, PublicIncident["updates"]>();
    for (const u of updates ?? []) {
      const arr = byIncident.get(u.incident_id as string) ?? [];
      arr.push({
        id: u.id as string,
        status: u.status as IncidentStatus,
        message: u.message as string,
        created_at: u.created_at as string,
      });
      byIncident.set(u.incident_id as string, arr);
    }
    return rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      summary: (r.summary as string) ?? null,
      status: r.status as IncidentStatus,
      impact: r.impact as IncidentImpact,
      affected_components: (r.affected_components as string[]) ?? [],
      started_at: r.started_at as string,
      resolved_at: (r.resolved_at as string) ?? null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      updates: byIncident.get(r.id as string) ?? [],
    }));
  },
);

// ---------- Admin ----------

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  summary: z.string().max(4000).nullable().optional(),
  status: z.enum(STATUSES),
  impact: z.enum(IMPACTS),
  affected_components: z.array(z.string().min(1).max(80)).max(30).default([]),
  started_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
  is_public: z.boolean().default(true),
});

export const listAdminIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("incidents")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAdminIncidentUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ incidentId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("incident_updates")
      .select("*")
      .eq("incident_id", data.incidentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => upsertSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const resolvedAt =
      data.status === "resolved"
        ? (data.resolved_at ?? new Date().toISOString())
        : (data.resolved_at ?? null);
    const payload = {
      title: data.title,
      summary: data.summary ?? null,
      status: data.status,
      impact: data.impact,
      affected_components: data.affected_components,
      started_at: data.started_at ?? new Date().toISOString(),
      resolved_at: resolvedAt,
      is_public: data.is_public,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("incidents").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(context, "admin.incident.updated", { title: data.title }, data.id);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("incidents")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context, "admin.incident.created", { title: data.title }, row.id as string);
    return { id: row.id as string };
  });

export const addIncidentUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        incidentId: z.string().uuid(),
        status: z.enum(STATUSES),
        message: z.string().trim().min(2).max(4000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("incident_updates")
      .insert({
        incident_id: data.incidentId,
        status: data.status,
        message: data.message,
        author_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Roll the parent incident's status/resolved_at forward.
    const patch: Record<string, unknown> = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("incidents")
      .update(patch)
      .eq("id", data.incidentId);
    if (upErr) throw new Error(upErr.message);
    await audit(
      context,
      "admin.incident.update_posted",
      { status: data.status },
      data.incidentId,
    );
    return { id: row.id as string };
  });

export const deleteIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("incidents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "admin.incident.deleted", {}, data.id);
    return { ok: true as const };
  });
