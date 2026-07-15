/**
 * Announcement Center — server functions.
 *
 * Public reads use a publishable-key client (RLS filters to active + published).
 * Admin writes gate on `is_super_admin` and audit every mutation.
 * Dismissals are stored per-user under RLS.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    targetType: "announcement",
    targetId: targetId ?? null,
    details,
  });
}

export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string;
  kind: "banner" | "popup" | "release_note" | "maintenance";
  severity: "info" | "warning" | "critical";
  audience: string;
  cta_label: string | null;
  cta_href: string | null;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  published_at: string | null;
};

/**
 * Public — returns active announcements. RLS already filters to
 * published + within window. Audience filtering is applied here.
 */
export const listActiveAnnouncements = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveAnnouncement[]> => {
    const supabase = makePublicClient();
    const { data, error } = await supabase
      .from("announcements")
      .select(
        "id, title, body, kind, severity, audience, cta_label, cta_href, starts_at, ends_at, dismissible, published_at",
      )
      .order("published_at", { ascending: false })
      .limit(20);
    if (error) {
      console.warn("[announcements] list failed", error.message);
      return [];
    }
    return (data ?? []).filter((row) =>
      row.audience === "all" || row.audience === "anonymous" || row.audience === "authenticated",
    ) as ActiveAnnouncement[];
  },
);

/** Authenticated — dismiss an announcement for the current user. */
export const dismissAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ announcementId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("announcement_dismissals")
      .insert({ announcement_id: data.announcementId, user_id: context.userId });
    // Duplicate is fine — user already dismissed it.
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true as const };
  });

/** Authenticated — list ids the current user has dismissed. */
export const listMyDismissals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("announcement_dismissals")
      .select("announcement_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.announcement_id as string);
  });

// ---------- Admin ----------

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  body: z.string().max(4000).default(""),
  kind: z.enum(["banner", "popup", "release_note", "maintenance"]),
  severity: z.enum(["info", "warning", "critical"]),
  audience: z.enum(["all", "authenticated", "anonymous", "plan", "role", "workspace", "super_admin"]),
  audience_filter: z.record(z.unknown()).default({}),
  cta_label: z.string().max(60).nullable().optional(),
  cta_href: z.string().url().max(500).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  dismissible: z.boolean().default(true),
  published: z.boolean().default(false),
});

export const listAdminAnnouncements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => upsertSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const publishedAt = data.published ? new Date().toISOString() : null;
    const payload = {
      title: data.title,
      body: data.body,
      kind: data.kind,
      severity: data.severity,
      audience: data.audience,
      audience_filter: data.audience_filter as never,
      cta_label: data.cta_label ?? null,
      cta_href: data.cta_href ?? null,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      dismissible: data.dismissible,
      published: data.published,
      published_at: publishedAt,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("announcements").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(context, "admin.announcement.updated", { title: data.title }, data.id);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("announcements")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context, "admin.announcement.created", { title: data.title }, row.id);
    return { id: row.id as string };
  });

export const setAnnouncementPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("announcements")
      .update({
        published: data.published,
        published_at: data.published ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context,
      data.published ? "admin.announcement.published" : "admin.announcement.unpublished",
      {},
      data.id,
    );
    return { ok: true as const };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, "admin.announcement.deleted", {}, data.id);
    return { ok: true as const };
  });

export const getAnnouncementDismissalStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("announcement_dismissals")
      .select("*", { count: "exact", head: true })
      .eq("announcement_id", data.id);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
