// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Route as RootRoute } from "@/routes/__root";
import { CONTACT_PHONES } from "@/lib/brand";

interface ContactPoint {
  "@type": string;
  telephone?: string;
  contactType?: string;
  description?: string;
}

interface OrgNode {
  "@type": string;
  telephone?: string;
  contactPoint?: ContactPoint[];
}

function extractOrganization(): OrgNode {
  const head = (
    RootRoute.options as { head?: () => { scripts?: Array<{ type?: string; children?: string }> } }
  ).head?.();
  const scripts = head?.scripts ?? [];
  const ld = scripts.find((s) => s.type === "application/ld+json");
  expect(ld, "Root route must include an application/ld+json script").toBeDefined();
  const parsed = JSON.parse(ld!.children!);
  const graph: OrgNode[] = parsed["@graph"] ?? [parsed];
  const org = graph.find((n) => n["@type"] === "Organization");
  expect(org, "JSON-LD @graph must contain an Organization node").toBeDefined();
  return org!;
}

describe("Organization JSON-LD contactPoint", () => {
  it("includes a contactPoint entry for every CONTACT_PHONES number with matching tel", () => {
    const org = extractOrganization();
    expect(Array.isArray(org.contactPoint), "contactPoint must be an array").toBe(true);
    const tels = (org.contactPoint ?? []).map((c) => c.telephone);
    for (const phone of CONTACT_PHONES) {
      expect(tels).toContain(phone.number);
      expect(phone.number).toMatch(/^\+\d{6,}$/);
    }
    expect(org.contactPoint!.length).toBeGreaterThanOrEqual(CONTACT_PHONES.length);
  });

  it("marks the WhatsApp Business number distinctly from the primary line", () => {
    const org = extractOrganization();
    const points = org.contactPoint ?? [];
    const whatsappEntry = CONTACT_PHONES.find((p) => p.kind === "whatsapp");
    const primaryEntry = CONTACT_PHONES.find((p) => p.kind === "primary");
    expect(whatsappEntry, "CONTACT_PHONES must include a whatsapp entry").toBeDefined();
    expect(primaryEntry, "CONTACT_PHONES must include a primary entry").toBeDefined();

    const whatsappPoint = points.find((c) => c.telephone === whatsappEntry!.number);
    const primaryPoint = points.find((c) => c.telephone === primaryEntry!.number);
    expect(whatsappPoint, "WhatsApp number must appear in contactPoint").toBeDefined();
    expect(primaryPoint, "Primary number must appear in contactPoint").toBeDefined();
    expect(whatsappPoint!.contactType).not.toEqual(primaryPoint!.contactType);
  });

  it("top-level telephone matches the primary CONTACT_PHONES entry", () => {
    const org = extractOrganization();
    const primary = CONTACT_PHONES.find((p) => p.kind === "primary")!;
    expect(org.telephone).toBe(primary.number);
  });
});
