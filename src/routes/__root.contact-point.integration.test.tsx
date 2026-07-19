// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PhoneList } from "@/components/phone-link";
import { Route as RootRoute } from "@/routes/__root";
import { CONTACT_PHONES } from "@/lib/brand";

afterEach(() => cleanup());

interface ContactPoint {
  "@type": string;
  telephone: string;
  contactType?: string;
  description?: string;
}
interface JsonLdNode {
  "@type": string;
  telephone?: string;
  contactPoint?: ContactPoint[];
}

function extractOrganization(): JsonLdNode {
  const head = (
    RootRoute.options as {
      head?: () => { scripts?: Array<{ type?: string; children?: string }> };
    }
  ).head?.();
  const ld = (head?.scripts ?? []).find((s) => s.type === "application/ld+json");
  expect(ld, "Root must emit application/ld+json").toBeDefined();
  const parsed = JSON.parse(ld!.children!);
  const graph: JsonLdNode[] = parsed["@graph"] ?? [parsed];
  const org = graph.find((n) => n["@type"] === "Organization");
  expect(org, "JSON-LD must contain an Organization node").toBeDefined();
  return org!;
}

function renderedPhoneListTels(): string[] {
  const { container } = render(<PhoneList />);
  return Array.from(container.querySelectorAll('a[href^="tel:"]')).map(
    (a) => (a.getAttribute("href") ?? "").replace(/^tel:/, ""),
  );
}

describe("Organization JSON-LD contactPoint ↔ PhoneList integration", () => {
  it("contactPoint telephones match the numbers rendered by PhoneList exactly", () => {
    const org = extractOrganization();
    const points = org.contactPoint ?? [];
    const jsonLdTels = points.map((c) => c.telephone).sort();
    const renderedTels = renderedPhoneListTels().sort();

    // Same set the Contact page and Footer show.
    expect(renderedTels).toEqual(jsonLdTels);
  });

  it("every CONTACT_PHONES number appears in both PhoneList and contactPoint", () => {
    const org = extractOrganization();
    const jsonLdTels = new Set((org.contactPoint ?? []).map((c) => c.telephone));
    const renderedTels = new Set(renderedPhoneListTels());

    expect(CONTACT_PHONES.length).toBeGreaterThan(0);
    for (const p of CONTACT_PHONES) {
      expect(renderedTels.has(p.number), `PhoneList missing ${p.number}`).toBe(true);
      expect(jsonLdTels.has(p.number), `contactPoint missing ${p.number}`).toBe(true);
    }
  });

  it("no extra numbers appear in contactPoint that PhoneList does not render", () => {
    const org = extractOrganization();
    const renderedTels = new Set(renderedPhoneListTels());
    for (const c of org.contactPoint ?? []) {
      expect(
        renderedTels.has(c.telephone),
        `contactPoint has ${c.telephone} but PhoneList does not render it`,
      ).toBe(true);
    }
  });

  it("top-level telephone equals the primary CONTACT_PHONES entry and is rendered by PhoneList", () => {
    const org = extractOrganization();
    const primary = CONTACT_PHONES.find((p) => p.kind === "primary");
    expect(primary, "CONTACT_PHONES must include a primary entry").toBeDefined();
    expect(org.telephone).toBe(primary!.number);
    expect(renderedPhoneListTels()).toContain(primary!.number);
  });

  it("WhatsApp entry is reachable from PhoneList and flagged in contactPoint", () => {
    const org = extractOrganization();
    const whatsapp = CONTACT_PHONES.find((p) => p.kind === "whatsapp");
    expect(whatsapp, "CONTACT_PHONES must include a whatsapp entry").toBeDefined();

    expect(renderedPhoneListTels()).toContain(whatsapp!.number);

    const whatsappPoint = (org.contactPoint ?? []).find(
      (c) => c.telephone === whatsapp!.number,
    );
    expect(whatsappPoint, "contactPoint must include the WhatsApp number").toBeDefined();
    const marker = `${whatsappPoint!.description ?? ""} ${whatsappPoint!.contactType ?? ""}`.toLowerCase();
    expect(marker.includes("whatsapp")).toBe(true);
  });

  it("every rendered tel: uses E.164 format (matches CONTACT_PHONES source)", () => {
    for (const num of renderedPhoneListTels()) {
      expect(num).toMatch(/^\+[1-9]\d{6,14}$/);
      expect(CONTACT_PHONES.some((p) => p.number === num)).toBe(true);
    }
  });
});
