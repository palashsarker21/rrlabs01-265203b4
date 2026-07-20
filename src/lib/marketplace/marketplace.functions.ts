import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/rbac/rbac.functions";

const filterSchema = z.object({
  industry: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
  channel: z.enum(["email", "whatsapp"]).optional().nullable(),
  failureClass: z.enum(["auth_required","expired_card","fraud_suspected","gateway_timeout","hard_decline","incorrect_cvc","insufficient_funds","network_error","soft_decline","temporary_bank","unknown"]).optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.number().int().min(1).max(100).default(50),
});

/** Browse published marketplace templates (single-message). */
export const listMarketplaceTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("marketplace_templates")
      .select(
        "id, slug, name, description, industry, region, country, language, channel, failure_classification, tone, step, tags, usage_count, published_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(data.limit);

    if (data.industry) q = q.eq("industry", data.industry);
    if (data.region) q = q.eq("region", data.region);
    if (data.language) q = q.eq("language", data.language);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.failureClass) q = q.eq("failure_classification", data.failureClass);
    if (data.q && data.q.trim()) {
      const term = data.q.trim().replace(/[%,]/g, "");
      q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return { items: rows ?? [] };
  });

/** Browse published marketplace flows (multi-step). */
export const listMarketplaceFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("marketplace_flows")
      .select(
        "id, slug, name, description, industry, region, country, language, failure_classification, tone, steps, tags, usage_count, published_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(data.limit);

    if (data.industry) q = q.eq("industry", data.industry);
    if (data.region) q = q.eq("region", data.region);
    if (data.language) q = q.eq("language", data.language);
    if (data.failureClass) q = q.eq("failure_classification", data.failureClass);
    if (data.q && data.q.trim()) {
      const term = data.q.trim().replace(/[%,]/g, "");
      q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return { items: rows ?? [] };
  });

/** Fetch one template by id (must be published or user is super_admin). */
export const getMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("marketplace_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Not found", { status: 404 });
    return { template: row };
  });

export const getMarketplaceFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("marketplace_flows")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Not found", { status: 404 });
    return { flow: row };
  });

/**
 * Install a marketplace template into a workspace's recovery_templates,
 * with optional inline overrides. Requires templates.write in the workspace.
 * The (workspace_id, step, channel) unique key is respected: if the requested
 * step is taken for that channel we auto-bump to the next free step.
 */
export const installTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      workspaceId: string;
      marketplaceTemplateId: string;
      overrides?: {
        step?: number;
        subject?: string | null;
        body_text?: string | null;
        body_html?: string | null;
        tone?: string | null;
        language?: string | null;
        country?: string | null;
      } | null;
    }) =>
      z
        .object({
          workspaceId: z.string().uuid(),
          marketplaceTemplateId: z.string().uuid(),
          overrides: z
            .object({
              step: z.number().int().min(1).max(20).optional(),
              subject: z.string().nullable().optional(),
              body_text: z.string().nullable().optional(),
              body_html: z.string().nullable().optional(),
              tone: z.string().nullable().optional(),
              language: z.string().nullable().optional(),
              country: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, data.workspaceId, "templates.write");

    const { data: src, error: srcErr } = await supabase
      .from("marketplace_templates")
      .select("*")
      .eq("id", data.marketplaceTemplateId)
      .maybeSingle();
    if (srcErr) throw new Response(srcErr.message, { status: 500 });
    if (!src || src.status !== "published")
      throw new Response("Template not available", { status: 404 });

    const ov = data.overrides ?? {};
    const desiredStep = ov.step ?? src.step;

    // find a free step for this channel in the workspace
    const { data: existing } = await supabase
      .from("recovery_templates")
      .select("step")
      .eq("workspace_id", data.workspaceId)
      .eq("channel", src.channel);
    const taken = new Set((existing ?? []).map((r) => r.step));
    let step = desiredStep;
    while (taken.has(step) && step < 20) step += 1;

    const insertRow = {
      workspace_id: data.workspaceId,
      step,
      channel: src.channel,
      subject: ov.subject ?? src.subject,
      body_text: ov.body_text ?? src.body_text,
      body_html: ov.body_html ?? src.body_html,
      language: ov.language ?? src.language,
      country: ov.country ?? src.country,
      tone: ov.tone ?? src.tone,
      failure_classification: src.failure_classification,
      product_kind: src.product_kind,
      customer_segment: src.customer_segment,
      source: "curated" as const,
      enabled: true,
      confidence: 0.6,
    };

    const { data: created, error: insErr } = await supabase
      .from("recovery_templates")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr) throw new Response(insErr.message, { status: 500 });

    await supabase.from("template_installations").insert({
      workspace_id: data.workspaceId,
      marketplace_template_id: src.id,
      recovery_template_id: created.id,
      installed_by: userId,
      version_installed: src.version,
      overrides: ov,
    });

    // best-effort usage count bump (RLS may block; ignore)
    await supabase
      .from("marketplace_templates")
      .update({ usage_count: (src.usage_count ?? 0) + 1 })
      .eq("id", src.id);

    return { ok: true, recoveryTemplateId: created.id, step };
  });

/**
 * Install a multi-step flow: creates one recovery_template per step, tagged
 * with the flow's classification. Requires templates.write.
 */
export const installFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; marketplaceFlowId: string }) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        marketplaceFlowId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, data.workspaceId, "templates.write");

    const { data: flow, error: fErr } = await supabase
      .from("marketplace_flows")
      .select("*")
      .eq("id", data.marketplaceFlowId)
      .maybeSingle();
    if (fErr) throw new Response(fErr.message, { status: 500 });
    if (!flow || flow.status !== "published")
      throw new Response("Flow not available", { status: 404 });

    const { data: existing } = await supabase
      .from("recovery_templates")
      .select("step, channel")
      .eq("workspace_id", data.workspaceId);
    const taken = new Map<string, Set<number>>();
    for (const r of existing ?? []) {
      const key = r.channel as string;
      if (!taken.has(key)) taken.set(key, new Set());
      taken.get(key)!.add(r.step);
    }

    const steps = Array.isArray(flow.steps) ? (flow.steps as Record<string, unknown>[]) : [];
    const createdIds: string[] = [];

    for (const s of steps) {
      const channel = (s.channel as "email" | "whatsapp") ?? "email";
      const stepSet = taken.get(channel) ?? new Set<number>();
      let step = Number(s.step ?? 1);
      while (stepSet.has(step) && step < 20) step += 1;
      stepSet.add(step);
      taken.set(channel, stepSet);

      const insertRow = {
        workspace_id: data.workspaceId,
        step,
        channel,
        subject: (s.subject as string | null) ?? null,
        body_text: (s.body_text as string | null) ?? null,
        body_html: (s.body_html as string | null) ?? null,
        language: flow.language,
        country: flow.country,
        tone: (s.tone as string | null) ?? flow.tone,
        failure_classification: flow.failure_classification,
        product_kind: flow.product_kind,
        customer_segment: flow.customer_segment,
        source: "curated" as const,
        enabled: true,
        confidence: 0.6,
      };

      const { data: created, error: insErr } = await supabase
        .from("recovery_templates")
        .insert(insertRow)
        .select("id")
        .single();
      if (insErr) throw new Response(insErr.message, { status: 500 });
      createdIds.push(created.id);
    }

    await supabase.from("flow_installations").insert({
      workspace_id: data.workspaceId,
      marketplace_flow_id: flow.id,
      recovery_template_ids: createdIds,
      installed_by: userId,
      version_installed: flow.version,
    });

    await supabase
      .from("marketplace_flows")
      .update({ usage_count: (flow.usage_count ?? 0) + 1 })
      .eq("id", flow.id);

    return { ok: true, createdTemplateIds: createdIds };
  });

/** List a workspace's installations, newest first. */
export const listWorkspaceInstallations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) =>
    z.object({ workspaceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: tpl }, { data: flow }] = await Promise.all([
      context.supabase
        .from("template_installations")
        .select(
          "id, installed_at, version_installed, marketplace_template:marketplace_template_id(name, industry, region, language, channel), recovery_template_id",
        )
        .eq("workspace_id", data.workspaceId)
        .order("installed_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("flow_installations")
        .select(
          "id, installed_at, version_installed, marketplace_flow:marketplace_flow_id(name, industry, region, language), recovery_template_ids",
        )
        .eq("workspace_id", data.workspaceId)
        .order("installed_at", { ascending: false })
        .limit(50),
    ]);
    return { templates: tpl ?? [], flows: flow ?? [] };
  });

// ============================================================
// Admin (super_admin) — CRUD for marketplace items
// ============================================================

const templateUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(3).max(80),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  industry: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  language: z.string().min(2).max(8).default("en"),
  channel: z.enum(["email", "whatsapp"]),
  failure_classification: z
    .enum([
      "auth_required",
      "expired_card",
      "fraud_suspected",
      "gateway_timeout",
      "hard_decline",
      "incorrect_cvc",
      "insufficient_funds",
      "network_error",
      "soft_decline",
      "temporary_bank",
      "unknown",
    ])
    .optional()
    .nullable(),
  tone: z.string().optional().nullable(),
  step: z.number().int().min(1).max(20).default(1),
  subject: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export const adminUpsertMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSA) throw new Response("Forbidden", { status: 403 });

    const payload = {
      ...data,
      created_by: userId,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("marketplace_templates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Response(error.message, { status: 500 });
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("marketplace_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return { id: row.id };
  });

export const adminListMarketplaceTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSA) throw new Response("Forbidden", { status: 403 });
    const { data, error } = await supabase
      .from("marketplace_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return { items: data ?? [] };
  });

export const adminDeleteMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSA) throw new Response("Forbidden", { status: 403 });
    const { error } = await supabase.from("marketplace_templates").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// Facets: available filter values across published items
export const listMarketplaceFacets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("marketplace_templates")
      .select("industry, region, language, channel")
      .eq("status", "published");
    if (error) throw new Response(error.message, { status: 500 });
    const industries = new Set<string>();
    const regions = new Set<string>();
    const languages = new Set<string>();
    const channels = new Set<string>();
    for (const r of rows ?? []) {
      if (r.industry) industries.add(r.industry);
      if (r.region) regions.add(r.region);
      if (r.language) languages.add(r.language);
      if (r.channel) channels.add(r.channel);
    }
    return {
      industries: [...industries].sort(),
      regions: [...regions].sort(),
      languages: [...languages].sort(),
      channels: [...channels].sort(),
    };
  });
