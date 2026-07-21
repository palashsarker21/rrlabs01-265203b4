import { describe, expect, it } from "vitest";
import { evaluatePassword, generateStrongPassword, safeRedirectPath } from "./password-policy";

describe("evaluatePassword", () => {
  it("rates empty as too weak", () => {
    const r = evaluatePassword("");
    expect(r.score).toBe(0);
    expect(r.strong).toBe(false);
    expect(r.label).toBe("Too weak");
  });

  it("recognizes a full-strength password", () => {
    const r = evaluatePassword("Abcdefg1!");
    expect(r.score).toBe(5);
    expect(r.strong).toBe(true);
  });

  it("misses uppercase-only complaint", () => {
    const r = evaluatePassword("abcdefg1!");
    expect(r.passed.has("upper")).toBe(false);
    expect(r.strong).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("returns fallback when empty", () => {
    expect(safeRedirectPath(undefined)).toBe("/app");
  });
  it("accepts same-origin relative", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
  });
  it("rejects protocol-relative", () => {
    expect(safeRedirectPath("//evil.com/x")).toBe("/app");
  });
  it("rejects absolute cross-origin", () => {
    expect(safeRedirectPath("https://evil.com/x")).toBe("/app");
  });
});

describe("generateStrongPassword", () => {
  it("produces a password satisfying every rule", () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateStrongPassword();
      const ev = evaluatePassword(pw);
      expect(ev.strong).toBe(true);
      expect(pw.length).toBeGreaterThanOrEqual(12);
    }
  });
  it("honors a longer requested length", () => {
    expect(generateStrongPassword(24)).toHaveLength(24);
  });
});
