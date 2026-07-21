import { describe, expect, it } from "vitest";
import { matchTemplate, type TemplateRow } from "./match-template.server";

const t = (over: Partial<TemplateRow>): TemplateRow => ({
  id: crypto.randomUUID(),
  workspace_id: "ws",
  step: 1,
  channel: "email",
  subject: "Payment issue",
  body_text: "Body",
  body_html: null,
  failure_classification: null,
  country: null,
  language: null,
  gateway: null,
  product_kind: null,
  customer_segment: null,
  tone: null,
  source: "curated",
  usage_count: 0,
  success_count: 0,
  confidence: 0.5,
  enabled: true,
  ...over,
});

describe("matchTemplate", () => {
  it("returns no match on empty pool", () => {
    const r = matchTemplate(
      [],
      {
        step: 1,
        channel: "email",
        classification: "expired_card",
        language: "en",
      },
      0.7,
    );
    expect(r.matched).toBe(false);
    expect(r.template).toBeNull();
  });

  it("prefers exact classification + language match", () => {
    const generic = t({ failure_classification: null, language: null });
    const specific = t({ failure_classification: "expired_card", language: "en" });
    const r = matchTemplate(
      [generic, specific],
      {
        step: 1,
        channel: "email",
        classification: "expired_card",
        language: "en",
      },
      0.7,
    );
    expect(r.template?.id).toBe(specific.id);
    expect(r.matched).toBe(true);
  });

  it("skips wrong channel/step", () => {
    const wrong = t({ channel: "whatsapp", failure_classification: "expired_card" });
    const r = matchTemplate(
      [wrong],
      {
        step: 1,
        channel: "email",
        classification: "expired_card",
        language: "en",
      },
      0.5,
    );
    expect(r.template).toBeNull();
  });

  it("boosts templates with historical success", () => {
    const cold = t({ failure_classification: "expired_card", language: "en" });
    const hot = t({
      failure_classification: "expired_card",
      language: "en",
      usage_count: 50,
      success_count: 40,
    });
    const r = matchTemplate(
      [cold, hot],
      {
        step: 1,
        channel: "email",
        classification: "expired_card",
        language: "en",
      },
      0.7,
    );
    expect(r.template?.id).toBe(hot.id);
  });
});
