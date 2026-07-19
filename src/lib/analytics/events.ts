/**
 * Public-site analytics event registry.
 *
 * Fires in two channels (user-selected):
 *   1. `window.dataLayer.push(...)` — picked up by any tag manager
 *      (GTM/Plausible/PostHog) if the user later wires one in.
 *   2. Server persistence via `recordAnalyticsEvent` (best-effort, no PII).
 *
 * All calls are fire-and-forget and never throw — an analytics failure
 * MUST NOT break UI interactions.
 */
import { recordAnalyticsEvent } from "@/lib/analytics.functions";

/**
 * Canonical event names. Extend here only — do NOT introduce ad-hoc strings
 * at call sites; the registry is the single source of truth.
 */
export type AnalyticsEventName =
  | "social_link_click"
  | "phone_click"
  | "phone_copy"
  | "email_click"
  | "email_copy"
  | "website_click"
  | "website_copy"
  | "share_click"
  | "share_copy_link";

export interface AnalyticsEventPayload {
  /** Page path where the event originated. */
  page?: string;
  /** UI component that produced the event (e.g. "footer", "contact", "share-bar"). */
  component?: string;
  /** Platform / channel (e.g. "linkedin", "primary", "email"). */
  platform?: string;
  /** Free-form extra metadata; keep small, no PII. */
  meta?: Record<string, string | number | boolean | null>;
}

interface DataLayerWindow {
  dataLayer?: Array<Record<string, unknown>>;
}

function currentPage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname + window.location.search;
}

/**
 * Fire an analytics event. Safe to call from render — internally deferred.
 */
export function trackEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}) {
  const enriched = {
    event: name,
    page: payload.page ?? currentPage(),
    component: payload.component,
    platform: payload.platform,
    timestamp: new Date().toISOString(),
    ...payload.meta,
  };

  // Channel 1: dataLayer push (any GTM/Plausible/PostHog picks this up).
  if (typeof window !== "undefined") {
    const w = window as unknown as DataLayerWindow;
    (w.dataLayer ??= []).push(enriched);
  }

  // Channel 2: server persistence (best-effort, deferred, never throws).
  if (typeof window !== "undefined") {
    // Defer to next tick so we never block the click's default action.
    setTimeout(() => {
      void recordAnalyticsEvent({
        data: {
          name,
          page: enriched.page ?? null,
          component: payload.component ?? null,
          platform: payload.platform ?? null,
          meta: payload.meta ?? null,
        },
      }).catch(() => {
        /* swallow — analytics must never surface to users */
      });
    }, 0);
  }
}
