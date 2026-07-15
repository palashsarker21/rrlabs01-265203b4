import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(64).optional(),
});

export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const source = data.source ?? "blog";

    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email, source, unsubscribed_at: null },
        { onConflict: "email", ignoreDuplicates: false },
      );

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[newsletter] subscribe failed", { message: error.message });
      throw new Error("Subscription failed. Please try again shortly.");
    }

    return { ok: true as const };
  });
