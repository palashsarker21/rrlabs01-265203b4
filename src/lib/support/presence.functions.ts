/** Presence + typing indicator server functions. Typing uses Realtime broadcast on the client. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ status: z.enum(["online", "available", "busy", "away", "offline"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isStaff } = await supabase.rpc("is_support_staff", { _user_id: userId });
    const { error } = await supabase.from("support_presence").upsert(
      {
        user_id: userId,
        status: data.status,
        last_seen_at: new Date().toISOString(),
        is_staff: Boolean(isStaff),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const heartbeatPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("support_presence")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: true };
  });

export const listStaffPresence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("support_presence")
      .select("user_id, status, last_seen_at, is_staff")
      .eq("is_staff", true);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
