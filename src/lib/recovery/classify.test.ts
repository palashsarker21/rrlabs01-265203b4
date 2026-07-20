import { describe, expect, it } from "vitest";
import { classifyFailure, isRetryable } from "./classify.server";

describe("classifyFailure", () => {
  it("maps expired_card via decline_code", () => {
    expect(classifyFailure({ decline_code: "expired_card" })).toBe("expired_card");
  });
  it("maps insufficient_funds via failure_code", () => {
    expect(classifyFailure({ failure_code: "insufficient_funds" })).toBe(
      "insufficient_funds",
    );
  });
  it("maps 3DS auth requirement via decline_code", () => {
    expect(classifyFailure({ decline_code: "authentication_required" })).toBe(
      "auth_required",
    );
  });
  it("maps fraud via decline_code", () => {
    expect(classifyFailure({ decline_code: "fraudulent" })).toBe("fraud_suspected");
    expect(classifyFailure({ decline_code: "stolen_card" })).toBe("fraud_suspected");
  });
  it("falls back to message heuristic when codes miss", () => {
    expect(
      classifyFailure({
        failure_code: null,
        failure_message: "Your card has expired.",
      }),
    ).toBe("expired_card");
    expect(
      classifyFailure({ failure_message: "3DS authentication required" }),
    ).toBe("auth_required");
  });
  it("returns unknown when nothing matches", () => {
    expect(classifyFailure({ failure_message: "purple monkey dishwasher" })).toBe(
      "unknown",
    );
    expect(classifyFailure({})).toBe("unknown");
  });
});

describe("isRetryable", () => {
  it("blocks retries for expired/CVC/fraud/hard declines", () => {
    expect(isRetryable("expired_card")).toBe(false);
    expect(isRetryable("incorrect_cvc")).toBe(false);
    expect(isRetryable("fraud_suspected")).toBe(false);
    expect(isRetryable("hard_decline")).toBe(false);
  });
  it("allows retries for soft/temporary/network failures", () => {
    expect(isRetryable("soft_decline")).toBe(true);
    expect(isRetryable("temporary_bank")).toBe(true);
    expect(isRetryable("insufficient_funds")).toBe(true);
    expect(isRetryable("gateway_timeout")).toBe(true);
  });
});
