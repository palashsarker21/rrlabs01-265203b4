import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Public-site analytics event ingestion.
 *
 * Unauthenticated (visitors on public pages should be trackable) but
 * strictly validated + bounded. Writes through the publishable-key client,
 * relying on a narrow `TO anon` INSERT policy on `public.analytics_events`.
 *
 * Never returns rows to callers — reads are admin-only via RLS.
 */

const InputSchema = z.object({
  name: z.string().min(1).max(64),
  page: z.string().max(512).nullable().optional(),
  component: z.string().max(64).nullable().optional(),
  platform: z.string().max(64).nullable().optional(),
  meta: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable()
    .optional(),
});

export const recordAnalyticsEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { ok: false, reason: "not_configured" as const };

    const client = createClient<Database>(url, key, {
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

    // Best-effort insert; ignore failures (analytics must not surface errors).
    // Table typing may lag migration — cast the client for the insert only.
    const anyClient = client as unknown as {
      from: (t: string) => {
        insert: (rows: unknown) => Promise<{ error: unknown }>;
      };
    };
    await anyClient
      .from("analytics_events")
      .insert({
        name: data.name,
        page: data.page ?? null,
        component: data.component ?? null,
        platform: data.platform ?? null,
        meta: data.meta ?? null,
      })
      .catch(() => undefined);

    return { ok: true as const };
  });
