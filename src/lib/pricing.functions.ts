import { createServerFn } from "@tanstack/react-start";

import type { PricingContent, CompareRow, FaqItem } from "@/lib/pricing";

/**
 * Public: cross-plan marketing content sourced from `public.site_content`
 * (Wave 2 Pricing SSOT). Falls back to safe defaults if any row is missing
 * so the marketing site never renders blank sections.
 */
export const getPricingContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingContent> => {
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

    const { data, error } = await client
      .from("site_content")
      .select("key, value")
      .in("key", [
        "pricing.trial_days",
        "pricing.trust_badges",
        "pricing.compare_rows",
        "pricing.faq",
      ]);
    if (error) throw error;

    const map = new Map<string, unknown>();
    for (const row of data ?? []) map.set(row.key, row.value);

    const trialDays =
      typeof map.get("pricing.trial_days") === "number"
        ? (map.get("pricing.trial_days") as number)
        : 14;
    const trustBadges = Array.isArray(map.get("pricing.trust_badges"))
      ? ((map.get("pricing.trust_badges") as unknown[]).filter(
          (b): b is string => typeof b === "string",
        ) as string[])
      : [];
    const compareRows = Array.isArray(map.get("pricing.compare_rows"))
      ? ((map.get("pricing.compare_rows") as unknown[]).filter(
          (r): r is CompareRow =>
            !!r && typeof (r as CompareRow).label === "string" && Array.isArray((r as CompareRow).values),
        ) as CompareRow[])
      : [];
    const faq = Array.isArray(map.get("pricing.faq"))
      ? ((map.get("pricing.faq") as unknown[]).filter(
          (f): f is FaqItem =>
            !!f && typeof (f as FaqItem).q === "string" && typeof (f as FaqItem).a === "string",
        ) as FaqItem[])
      : [];

    return { trialDays, trustBadges, compareRows, faq };
  },
);
