/**
 * Support conversation server functions.
 * All writes go through RLS. Auto-assignment uses the DB `next_support_assignee()`
 * function so the ladder + presence check runs atomically on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AUTO_REPLY =
  "We've received your message. A member of our support team will respond as soon as possible.";

/** Start a new conversation (customer-initiated). */
export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(1).max(8000),
        category: z
          .enum([
            "general",
            "billing",
            "technical",
            "integration",
            "recovery_engine",
            "bug_report",
            "feature_request",
            "security",
            "account",
            "other",
          ])
          .default("general"),
        priority: z.enum(["low", "normal", "high", "urgent", "critical"]).default("normal"),
        workspaceId: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: conv, error: convError } = await supabase
      .from("support_conversations")
      .insert({
        customer_id: userId,
        workspace_id: data.workspaceId ?? null,
        subject: data.subject ?? null,
        category: data.category,
        priority: data.priority,
        status: "open",
        last_message_at: new Date().toISOString(),
        unread_staff: 1,
      })
      .select("id")
      .single();
    if (convError || !conv) throw new Error(convError?.message ?? "Failed to create conversation");

    // First message
    const { error: msgError } = await supabase.from("support_messages").insert({
      conversation_id: conv.id,
      sender_id: userId,
      kind: "text",
      body: data.body,
      is_staff: false,
      delivery_status: "sent",
    });
    if (msgError) throw new Error(msgError.message);

    // Add customer as participant
    await supabase
      .from("support_participants")
      .insert({ conversation_id: conv.id, user_id: userId, role: "customer" });

    // Try auto-assignment via DB helper (agent → admin → moderator → super_admin, online only)
    const { data: assigneeId } = await supabase.rpc("next_support_assignee");

    if (assigneeId) {
      await supabase
        .from("support_conversations")
        .update({ assigned_to: assigneeId, status: "pending" })
        .eq("id", conv.id);
      await supabase.from("support_assignments").insert({
        conversation_id: conv.id,
        assignee_id: assigneeId,
        assigned_by: userId,
        reason: "auto_route",
      });
      await supabase
        .from("support_participants")
        .insert({ conversation_id: conv.id, user_id: assigneeId, role: "agent" })
        .select();
    } else {
      // Nobody online → queue + auto-response system message
      await supabase.from("support_messages").insert({
        conversation_id: conv.id,
        sender_id: null,
        kind: "system",
        body: AUTO_REPLY,
        is_staff: true,
        delivery_status: "sent",
      });
      await supabase
        .from("support_conversations")
        .update({ status: "waiting", unread_customer: 1 })
        .eq("id", conv.id);
    }

    await supabase.from("support_activity_logs").insert({
      conversation_id: conv.id,
      actor_id: userId,
      action: "conversation.created",
      payload: { category: data.category, priority: data.priority, auto_assigned: Boolean(assigneeId) },
    });

    return { id: conv.id, assignedTo: assigneeId ?? null };
  });

/** List my conversations (customer). Staff should use staffInboxList. */
export const listMyConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("support_conversations")
      .select(
        "id, subject, status, priority, category, assigned_to, last_message_at, unread_customer, created_at, updated_at, ai_summary",
      )
      .eq("customer_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Staff inbox list with filters. */
export const staffInboxList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        status: z
          .array(z.enum(["open", "pending", "waiting", "resolved", "closed", "archived"]))
          .optional(),
        priority: z.array(z.enum(["low", "normal", "high", "urgent", "critical"])).optional(),
        assignee: z.enum(["me", "unassigned", "any"]).default("any"),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");

    let q = supabase
      .from("support_conversations")
      .select(
        "id, customer_id, subject, status, priority, category, assigned_to, last_message_at, unread_staff, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    if (data.status?.length) q = q.in("status", data.status);
    if (data.priority?.length) q = q.in("priority", data.priority);
    if (data.assignee === "me") q = q.eq("assigned_to", userId);
    else if (data.assignee === "unassigned") q = q.is("assigned_to", null);
    if (data.search) q = q.ilike("subject", `%${data.search}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Staff inbox aggregate metrics. */
export const staffInboxMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");

    const [openR, waitingR, mineR, unassignedR, csatR] = await Promise.all([
      supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "waiting"),
      supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .in("status", ["open", "pending", "waiting"]),
      supabase
        .from("support_conversations")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .in("status", ["open", "waiting"]),
      supabase.from("support_feedback").select("stars"),
    ]);

    const feedbackRows = (csatR.data ?? []) as { stars: number }[];
    const csat =
      feedbackRows.length === 0
        ? null
        : feedbackRows.reduce((s, r) => s + Number(r.stars ?? 0), 0) / feedbackRows.length;

    return {
      open: openR.count ?? 0,
      waiting: waitingR.count ?? 0,
      assignedToMe: mineR.count ?? 0,
      unassigned: unassignedR.count ?? 0,
      csat,
      feedbackCount: feedbackRows.length,
    };
  });

/** Get a single conversation + messages. */
export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const conv = await supabase.from("support_conversations").select("*").eq("id", data.id).single();
    if (conv.error) throw new Error(conv.error.message);
    const msgs = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    if (msgs.error) throw new Error(msgs.error.message);
    return { conversation: conv.data, messages: msgs.data ?? [] };
  });

/** Manual assign / reassign (staff only). */
export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        assigneeId: z.string().uuid().nullable(),
        reason: z.string().max(200).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");

    await supabase
      .from("support_conversations")
      .update({ assigned_to: data.assigneeId, status: data.assigneeId ? "pending" : "waiting" })
      .eq("id", data.conversationId);
    await supabase.from("support_assignments").insert({
      conversation_id: data.conversationId,
      assignee_id: data.assigneeId,
      assigned_by: userId,
      reason: data.reason ?? "manual",
    });
    await supabase.from("support_activity_logs").insert({
      conversation_id: data.conversationId,
      actor_id: userId,
      action: data.assigneeId ? "conversation.assigned" : "conversation.unassigned",
      payload: { assignee: data.assigneeId, reason: data.reason ?? null },
    });
    return { ok: true };
  });

/** Close a conversation. */
export const closeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ conversationId: z.string().uuid(), resolutionNote: z.string().max(2000).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("support_conversations")
      .update({ status: "closed", closed_at: now, resolved_at: now })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);

    if (data.resolutionNote) {
      await supabase.from("support_messages").insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        kind: "system",
        body: data.resolutionNote,
        is_staff: true,
        delivery_status: "sent",
      });
    }
    await supabase.from("support_activity_logs").insert({
      conversation_id: data.conversationId,
      actor_id: userId,
      action: "conversation.closed",
      payload: {},
    });
    return { ok: true };
  });

/** Reopen a closed conversation. */
export const reopenConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ conversationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("support_conversations")
      .update({ status: "open", closed_at: null, resolved_at: null })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    await supabase.from("support_activity_logs").insert({
      conversation_id: data.conversationId,
      actor_id: userId,
      action: "conversation.reopened",
      payload: {},
    });
    return { ok: true };
  });

/** Submit CSAT feedback (customer only, once per conversation). */
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        stars: z.number().int().min(1).max(5),
        rating: z
          .enum(["very_unsatisfied", "unsatisfied", "neutral", "satisfied", "very_satisfied"])
          .optional(),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const conv = await supabase
      .from("support_conversations")
      .select("assigned_to")
      .eq("id", data.conversationId)
      .single();
    if (conv.error) throw new Error(conv.error.message);
    const { error } = await supabase.from("support_feedback").insert({
      conversation_id: data.conversationId,
      customer_id: userId,
      agent_id: conv.data?.assigned_to ?? null,
      stars: data.stars,
      rating: data.rating ?? null,
      comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Add a staff-only internal note. */
export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        mentions: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden");
    const { error } = await supabase.from("support_internal_notes").insert({
      conversation_id: data.conversationId,
      author_id: userId,
      body: data.body,
      mentions: data.mentions ?? [],
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
