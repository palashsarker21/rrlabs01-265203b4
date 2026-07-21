/**
 * Recovery decision engine — given a classified failure + customer signals +
 * workspace automation settings, decide the next action *without* generating
 * copy. Copy generation is a downstream step handled by the template matcher
 * or the AI engine only when a match is not confident enough.
 *
 * Pure function today (no I/O). The engine can call this before scheduling
 * next_run_at so quiet hours and retry schedules are honored consistently.
 */

import type { FailureClassification } from "./classify.server";
import { isRetryable } from "./classify.server";

export interface AutomationSettings {
  timezone: string;
  quiet_hours: { start: number; end: number } | null;
  max_retries: number;
  preferred_channels: string[];
  ai_enabled: boolean;
  retry_schedule_minutes: number[];
  template_reuse_threshold: number;
}

export const DEFAULT_AUTOMATION: AutomationSettings = {
  timezone: "UTC",
  quiet_hours: { start: 21, end: 8 },
  max_retries: 4,
  preferred_channels: ["whatsapp", "email", "sms"],
  ai_enabled: true,
  // Gaps BETWEEN attempts. The first attempt fires immediately from the
  // webhook path; these values schedule attempts #2, #3, and #4:
  //   attempt #2 → +2 hours, #3 → +24 hours, #4 → +72 hours.
  retry_schedule_minutes: [120, 1440, 4320],
  template_reuse_threshold: 0.72,
};

export interface DecisionInput {
  step: number; // 0-based cadence step already completed
  classification: FailureClassification;
  preferred_language?: string | null;
  preferred_timezone?: string | null;
  channels_available: string[]; // e.g. ['email','whatsapp']
  automation: AutomationSettings;
  now?: Date;
}

export interface Decision {
  should_send: boolean;
  reason: string;
  channel: string | null;
  language: string;
  tone: "warm" | "direct" | "urgent";
  send_at: Date;
  next_step: number;
  retry_schedule_minutes: number[];
  suggest_update_payment_method: boolean;
}

function nextChannel(step: number, preferred: string[], available: string[]): string | null {
  const ordered = preferred.filter((c) => available.includes(c));
  if (ordered.length === 0) return null;
  return ordered[step % ordered.length];
}

function inQuietHours(d: Date, q: AutomationSettings["quiet_hours"]): boolean {
  if (!q) return false;
  const h = d.getUTCHours();
  if (q.start === q.end) return false;
  if (q.start < q.end) return h >= q.start && h < q.end;
  return h >= q.start || h < q.end;
}

function shiftPastQuietHours(d: Date, q: AutomationSettings["quiet_hours"]): Date {
  if (!q || !inQuietHours(d, q)) return d;
  const out = new Date(d);
  while (inQuietHours(out, q)) {
    out.setUTCHours(out.getUTCHours() + 1, 0, 0, 0);
  }
  return out;
}

export function decideRecovery(input: DecisionInput): Decision {
  const now = input.now ?? new Date();
  const step = Math.max(0, input.step);
  const schedule = input.automation.retry_schedule_minutes ?? [120, 1440, 4320];
  const language = (input.preferred_language ?? "en").toLowerCase().slice(0, 5);

  if (step >= input.automation.max_retries) {
    return {
      should_send: false,
      reason: "max_retries_reached",
      channel: null,
      language,
      tone: "direct",
      send_at: now,
      next_step: step,
      retry_schedule_minutes: schedule,
      suggest_update_payment_method: !isRetryable(input.classification),
    };
  }

  if (input.channels_available.length === 0) {
    return {
      should_send: false,
      reason: "no_channel_connected",
      channel: null,
      language,
      tone: "warm",
      send_at: now,
      next_step: step,
      retry_schedule_minutes: schedule,
      suggest_update_payment_method: !isRetryable(input.classification),
    };
  }

  const channel = nextChannel(step, input.automation.preferred_channels, input.channels_available);

  const minutes = schedule[Math.min(step, schedule.length - 1)] ?? 60;
  const raw = new Date(now.getTime() + minutes * 60_000);
  const send_at = shiftPastQuietHours(raw, input.automation.quiet_hours);

  const tone: Decision["tone"] = step === 0 ? "warm" : step === 1 ? "direct" : "urgent";

  return {
    should_send: true,
    reason: "scheduled",
    channel,
    language,
    tone,
    send_at,
    next_step: step + 1,
    retry_schedule_minutes: schedule,
    suggest_update_payment_method: !isRetryable(input.classification),
  };
}
