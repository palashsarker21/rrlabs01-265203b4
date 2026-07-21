/** Message-level server functions: send, mark seen, edit, delete. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TablesUpdate } from "@/integrations/supabase/types";

// Simple per-user leaky bucket (per Worker instance).
const bucket = new Map<string, number[]>();
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 20;

function rateLimit(userId: string) {
  const now = Date.now();
  const list = (bucket.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW)
    throw new Error("You're sending messages too quickly. Please slow down.");
  list.push(now);
  bucket.set(userId, list);
}

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(8000),
        clientMessageId: z.string().max(100).optional(),
        attachments: z
          .array(
            z.object({
              id: z.string().uuid(),
              file_name: z.string(),
              content_type: z.string(),
              size_bytes: z.number().int().nonnegative(),
              storage_path: z.string(),
            }),
          )
          .max(10)
          .optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    rateLimit(userId);

    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    const conv = await supabase
      .from("support_conversations")
      .select("id, customer_id, first_response_at, status")
      .eq("id", data.conversationId)
      .single();
    if (conv.error || !conv.data) throw new Error(conv.error?.message ?? "Conversation not found");

    const senderIsStaff = Boolean(isStaff) && conv.data.customer_id !== userId;

    const { data: message, error } = await supabase
      .from("support_messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        kind: "text",
        body: data.body,
        is_staff: senderIsStaff,
        delivery_status: "sent",
        client_message_id: data.clientMessageId ?? null,
        attachments: data.attachments ?? [],
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    const patch: TablesUpdate<"support_conversations"> = { last_message_at: now };
    if (senderIsStaff) {
      patch.unread_customer = 1;
      if (!conv.data.first_response_at) patch.first_response_at = now;
      if (conv.data.status === "waiting") patch.status = "open";
    } else {
      patch.unread_staff = 1;
    }
    await supabase.from("support_conversations").update(patch).eq("id", data.conversationId);

    return { message };
  });

export const markSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ conversationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const conv = await supabase
      .from("support_conversations")
      .select("customer_id")
      .eq("id", data.conversationId)
      .single();
    if (conv.error) throw new Error(conv.error.message);
    const isCustomer = conv.data?.customer_id === userId;

    await supabase
      .from("support_messages")
      .update({ seen_at: now, delivery_status: "seen" })
      .eq("conversation_id", data.conversationId)
      .neq("sender_id", userId)
      .is("seen_at", null);

    await supabase
      .from("support_conversations")
      .update(isCustomer ? { unread_customer: 0 } : { unread_staff: 0 })
      .eq("id", data.conversationId);

    await supabase
      .from("support_participants")
      .update({ last_read_at: now })
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);

    return { ok: true };
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("support_messages")
      .update({ body: data.body, edited_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("support_messages")
      .update({ deleted_at: new Date().toISOString(), body: "[deleted]" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        q: z.string().trim().min(1).max(200),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("support_messages")
      .select("id, conversation_id, body, sender_id, created_at, is_staff")
      .ilike("body", `%${data.q}%`)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
