import { describe, it, expect } from "vitest";
import { computeHealthScore, gradeFor } from "./health-score";

describe("computeHealthScore", () => {
  it("returns 100 for a fully healthy integration tested moments ago", () => {
    const score = computeHealthScore({
      status: "connected",
      verification_status: "verified",
      last_test_ok: true,
      last_test_at: new Date().toISOString(),
      webhook: { retry_count: 0, last_error: null },
    });
    expect(score).toBe(100);
    expect(gradeFor(score)).toBe("excellent");
  });

  it("penalises unverified connections", () => {
    const score = computeHealthScore({
      status: "connected",
      verification_status: "pending",
      last_test_ok: false,
      last_test_at: null,
    });
    expect(score).toBeLessThan(75);
  });

  it("returns 0 for a disconnected integration with no signal", () => {
    const score = computeHealthScore({ status: "disconnected" });
    expect(score).toBeLessThanOrEqual(10);
  });

  it("gives partial credit when webhook has retries but no error", () => {
    const s1 = computeHealthScore({
      status: "connected",
      verification_status: "verified",
      last_test_ok: true,
      last_test_at: new Date().toISOString(),
      webhook: { retry_count: 2, last_error: null },
    });
    const s2 = computeHealthScore({
      status: "connected",
      verification_status: "verified",
      last_test_ok: true,
      last_test_at: new Date().toISOString(),
      webhook: { retry_count: 0, last_error: null },
    });
    expect(s1).toBeLessThan(s2);
  });
});
