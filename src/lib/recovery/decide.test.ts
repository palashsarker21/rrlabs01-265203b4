import { describe, expect, it } from "vitest";
import { decideRecovery, DEFAULT_AUTOMATION } from "./decide.server";

const base = {
  classification: "soft_decline" as const,
  preferred_language: "en",
  preferred_timezone: "UTC",
  automation: DEFAULT_AUTOMATION,
};

describe("decideRecovery", () => {
  it("stops after max_retries", () => {
    const d = decideRecovery({
      ...base,
      step: 4,
      channels_available: ["email"],
    });
    expect(d.should_send).toBe(false);
    expect(d.reason).toBe("max_retries_reached");
  });

  it("returns no channel when none available", () => {
    const d = decideRecovery({ ...base, step: 0, channels_available: [] });
    expect(d.should_send).toBe(false);
    expect(d.reason).toBe("no_channel_connected");
  });

  it("picks preferred channel first", () => {
    const d = decideRecovery({
      ...base,
      step: 0,
      channels_available: ["email", "whatsapp"],
    });
    expect(d.channel).toBe("whatsapp");
    expect(d.tone).toBe("warm");
  });

  it("shifts send_at past quiet hours", () => {
    // 22:00 UTC is inside default quiet window (21..8)
    const now = new Date(Date.UTC(2026, 0, 1, 22, 0, 0));
    const d = decideRecovery({
      ...base,
      step: 0,
      channels_available: ["email"],
      now,
    });
    // schedule[0] = 15 min → 22:15, still quiet, must jump past 08:00
    expect(d.send_at.getUTCHours()).toBe(8);
  });

  it("suggests update payment method for non-retryable classifications", () => {
    const d = decideRecovery({
      ...base,
      classification: "expired_card",
      step: 0,
      channels_available: ["email"],
    });
    expect(d.suggest_update_payment_method).toBe(true);
  });

  it("escalates tone with step", () => {
    const d0 = decideRecovery({ ...base, step: 0, channels_available: ["email"] });
    const d1 = decideRecovery({ ...base, step: 1, channels_available: ["email"] });
    const d2 = decideRecovery({ ...base, step: 2, channels_available: ["email"] });
    expect(d0.tone).toBe("warm");
    expect(d1.tone).toBe("direct");
    expect(d2.tone).toBe("urgent");
  });
});
