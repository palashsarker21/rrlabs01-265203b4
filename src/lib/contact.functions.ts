import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  seats: z.string().trim().max(40).optional().or(z.literal("")),
  arrRange: z.string().trim().max(40).optional().or(z.literal("")),
  useCase: z.string().trim().max(4000).optional().or(z.literal("")),
  planCode: z.string().trim().max(40).optional().or(z.literal("")),
  source: z.string().trim().max(80).optional().or(z.literal("")),
});

export const submitContactLead = createServerFn({ method: "POST" })
  .inputValidator((raw) => leadSchema.parse(raw))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const empty = (v: string | undefined) => (v && v.length > 0 ? v : null);
    const { error } = await client.from("contact_leads").insert({
      name: data.name,
      email: data.email,
      company: empty(data.company),
      role: empty(data.role),
      seats: empty(data.seats),
      arr_range: empty(data.arrRange),
      use_case: empty(data.useCase),
      plan_code: empty(data.planCode),
      source: empty(data.source) ?? "contact-sales",
    });
    if (error) {
      console.error("submitContactLead insert error", error);
      throw new Error("Could not submit your inquiry. Please try again.");
    }
    return { ok: true as const };
  });
