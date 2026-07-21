import { describe, expect, it } from "vitest";

import { pickNextAssignee, type StaffCandidate } from "./routing";

const base = (over: Partial<StaffCandidate>): StaffCandidate => ({
  userId: "u",
  role: "support_agent",
  status: "online",
  load: 0,
  ...over,
});

describe("support routing ladder", () => {
  it("prefers a support_agent over admin/moderator/super_admin", () => {
    const pick = pickNextAssignee([
      base({ userId: "a1", role: "admin" }),
      base({ userId: "s1", role: "support_agent" }),
      base({ userId: "m1", role: "moderator" }),
      base({ userId: "sa", role: "super_admin" }),
    ]);
    expect(pick?.userId).toBe("s1");
  });

  it("falls back to admin when no agent online", () => {
    const pick = pickNextAssignee([
      base({ userId: "s1", role: "support_agent", status: "offline" }),
      base({ userId: "a1", role: "admin" }),
      base({ userId: "m1", role: "moderator" }),
    ]);
    expect(pick?.userId).toBe("a1");
  });

  it("falls back to moderator when only moderator + super_admin online", () => {
    const pick = pickNextAssignee([
      base({ userId: "m1", role: "moderator" }),
      base({ userId: "sa", role: "super_admin" }),
    ]);
    expect(pick?.userId).toBe("m1");
  });

  it("falls back to super_admin when nobody else is online", () => {
    const pick = pickNextAssignee([
      base({ userId: "s1", role: "support_agent", status: "offline" }),
      base({ userId: "a1", role: "admin", status: "away" }),
      base({ userId: "sa", role: "super_admin" }),
    ]);
    expect(pick?.userId).toBe("sa");
  });

  it("returns null when nobody eligible is online (queued)", () => {
    const pick = pickNextAssignee([
      base({ userId: "s1", role: "support_agent", status: "busy" }),
      base({ userId: "a1", role: "admin", status: "away" }),
      base({ userId: "sa", role: "super_admin", status: "offline" }),
    ]);
    expect(pick).toBeNull();
  });

  it("breaks ties within a role by load then userId", () => {
    const pick = pickNextAssignee([
      base({ userId: "z", role: "support_agent", load: 1 }),
      base({ userId: "a", role: "support_agent", load: 3 }),
      base({ userId: "b", role: "support_agent", load: 1 }),
    ]);
    // load=1 candidates: z, b → alphabetical → b
    expect(pick?.userId).toBe("b");
  });

  it("treats `available` as eligible and `busy` as not eligible", () => {
    const pick = pickNextAssignee([
      base({ userId: "busy", role: "support_agent", status: "busy" }),
      base({ userId: "avail", role: "admin", status: "available" }),
    ]);
    expect(pick?.userId).toBe("avail");
  });
});
