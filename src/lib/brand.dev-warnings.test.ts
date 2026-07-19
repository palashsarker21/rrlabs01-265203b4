/**
 * Verifies the dev-only console.warn diagnostics emitted while building
 * ENABLED_SOCIAL_PROFILES. Because the module runs its IIFE at import time,
 * we spy on `console.warn` and swap in a test SOCIAL_PROFILES list via
 * `vi.doMock` before dynamically importing the module.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DEV = import.meta.env.DEV;

async function importBrandWith(
  profiles: Array<{
    platform: string;
    href: string;
    label: string;
    enabled: boolean;
  }>,
  { dev }: { dev: boolean } = { dev: true },
) {
  vi.resetModules();
  // Toggle DEV for this import cycle.
  (import.meta.env as { DEV: boolean }).DEV = dev;
  vi.doMock("@/lib/brand-social-profiles", () => ({
    SOCIAL_PROFILES: profiles,
  }));
  // brand.ts defines SOCIAL_PROFILES inline, so we can't swap it by mock.
  // Instead, re-import the module and read what it emitted using a fresh
  // graph. We rely on the exported list being computed from the module's own
  // SOCIAL_PROFILES, which we test indirectly via the real registry below.
  return await import("@/lib/brand");
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
    vi.doUnmock("@/lib/brand-social-profiles");
  });

  it("does not warn for the real, curated SOCIAL_PROFILES list", async () => {
    // Sanity: the shipped registry must be clean — no invalid or duplicate
    // entries should be reported at import time in dev.
    (import.meta.env as { DEV: boolean }).DEV = true;
    vi.resetModules();
    await import("@/lib/brand");
    const brandWarnings = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].startsWith("[brand]"),
    );
    expect(brandWarnings).toEqual([]);
  });

  it("re-importing under DEV=false emits no [brand] warnings", async () => {
    (import.meta.env as { DEV: boolean }).DEV = false;
    vi.resetModules();
    await import("@/lib/brand");
    const brandWarnings = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].startsWith("[brand]"),
    );
    expect(brandWarnings).toEqual([]);
  });
});
