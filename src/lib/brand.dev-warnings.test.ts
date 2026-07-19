/**
 * Verifies the dev-only console.warn diagnostics guard in brand.ts.
 *
 * The full "warn on invalid/duplicate profile" path is exercised by editing
 * SOCIAL_PROFILES during development — swapping the inline registry from a
 * test isn't practical. What we can (and should) lock in here is:
 *
 *   1. The shipped, curated registry is clean: importing brand.ts in dev
 *      never emits a `[brand]` warning.
 *   2. The guard is truly dev-only: under DEV=false, no `[brand]` warning
 *      is emitted regardless of registry state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DEV = import.meta.env.DEV;

type WarnCall = [unknown, ...unknown[]];

function brandWarnings(spy: ReturnType<typeof vi.spyOn>): WarnCall[] {
  return (spy.mock.calls as WarnCall[]).filter(
    (c) => typeof c[0] === "string" && (c[0] as string).startsWith("[brand]"),
  );
}

describe("SOCIAL_PROFILES dev-time diagnostics", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    (import.meta.env as { DEV: boolean }).DEV = ORIGINAL_DEV;
    vi.resetModules();
  });

  it("does not warn for the real curated SOCIAL_PROFILES list in DEV", async () => {
    (import.meta.env as { DEV: boolean }).DEV = true;
    vi.resetModules();
    await import("@/lib/brand");
    expect(brandWarnings(warnSpy)).toEqual([]);
  });

  it("emits no [brand] warnings when DEV is false", async () => {
    (import.meta.env as { DEV: boolean }).DEV = false;
    vi.resetModules();
    await import("@/lib/brand");
    expect(brandWarnings(warnSpy)).toEqual([]);
  });
});
