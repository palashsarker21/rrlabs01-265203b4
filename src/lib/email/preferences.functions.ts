/**
 * Server functions for the unsubscribe / email preferences center.
 *   - Public token-based flows: `getPreferencesByTokenFn`, `updatePreferencesByTokenFn`, `unsubscribeAllByTokenFn`
 *   - Signed-in flow: `getMyEmailPreferencesFn`, `updateMyEmailPreferencesFn`
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMAIL_CATEGORIES } from "@/lib/email/preferences";

const CATEGORIES = z.enum(EMAIL_CATEGORIES);
const PrefUpdate = z.record(CATEGORIES, z.boolean());

export const getPreferencesByTokenFn = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ token: z.string().min(8).max(2048) }).parse(v))
  .handler(async ({ data }) => {
    const { verifyUnsubscribeToken, loadPreferencesFor } =
      await import("@/lib/email/preferences.server");
    const verified = verifyUnsubscribeToken(data.token);
    if (!verified) return { ok: false as const, error: "invalid_or_expired_token" };
    const prefs = await loadPreferencesFor(verified.email);
    return {
      ok: true as const,
      email: verified.email,
      preferences: prefs,
    };
  });

export const updatePreferencesByTokenFn = createServerFn({ method: "POST" })
  .inputValidator((v) =>
    z
      .object({
        token: z.string().min(8).max(2048),
        preferences: PrefUpdate,
      })
      .parse(v),
  )
  .handler(async ({ data }) => {
    const { verifyUnsubscribeToken, setPreferences } =
      await import("@/lib/email/preferences.server");
    const verified = verifyUnsubscribeToken(data.token);
    if (!verified) return { ok: false as const, error: "invalid_or_expired_token" };
    const prefs = await setPreferences(verified.email, data.preferences, "unsubscribe_link");
    return { ok: true as const, email: verified.email, preferences: prefs };
  });

export const unsubscribeAllByTokenFn = createServerFn({ method: "POST" })
  .inputValidator((v) => z.object({ token: z.string().min(8).max(2048) }).parse(v))
  .handler(async ({ data }) => {
    const { verifyUnsubscribeToken, unsubscribeAll } =
      await import("@/lib/email/preferences.server");
    const verified = verifyUnsubscribeToken(data.token);
    if (!verified) return { ok: false as const, error: "invalid_or_expired_token" };
    const prefs = await unsubscribeAll(verified.email, "unsubscribe_link");
    return { ok: true as const, email: verified.email, preferences: prefs };
  });

export const getMyEmailPreferencesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { ok: false as const, error: "no_email_on_account" };
    const { loadPreferencesFor } = await import("@/lib/email/preferences.server");
    const prefs = await loadPreferencesFor(email);
    return { ok: true as const, email, preferences: prefs };
  });

export const updateMyEmailPreferencesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ preferences: PrefUpdate }).parse(v))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { ok: false as const, error: "no_email_on_account" };
    const { setPreferences } = await import("@/lib/email/preferences.server");
    const prefs = await setPreferences(email, data.preferences, "settings_page");
    return { ok: true as const, email, preferences: prefs };
  });
