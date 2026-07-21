import { describe, it, expect } from "vitest";
import { validateRequiredFields } from "./validate-required";
import { fail } from "./errors";

describe("validateRequiredFields — SaveFailure mapping", () => {
  const required = [
    { key: "api_key", label: "API Key" },
    { key: "store_url", label: "Store URL" },
    { key: "from_domain" }, // no label — falls back to key
  ] as const;

  it("returns null when every required field has a non-empty value", () => {
    const res = validateRequiredFields("Shopify", required, {
      api_key: "sk_live_abc",
      store_url: "https://x.myshopify.com",
      from_domain: "mail.x.com",
    });
    expect(res).toBeNull();
  });

  it("flags the first missing field when credentials are empty", () => {
    const res = validateRequiredFields("Shopify", required, {});
    expect(res).not.toBeNull();
    expect(res!.ok).toBe(false);
    expect(res!.code).toBe("missing_field");
    expect(res!.field).toBe("api_key");
    expect(res!.message).toBe("API Key is required to connect Shopify.");
    expect(res!.hint).toMatch(/Fill in every field/);
  });

  it("flags the first missing field in declaration order, not alphabetical", () => {
    const res = validateRequiredFields("Shopify", required, {
      store_url: "https://x.myshopify.com",
      from_domain: "mail.x.com",
    });
    expect(res!.field).toBe("api_key");
  });

  it("skips satisfied fields and reports the next missing one", () => {
    const res = validateRequiredFields("Shopify", required, {
      api_key: "sk_live_abc",
      from_domain: "mail.x.com",
    });
    expect(res!.field).toBe("store_url");
    expect(res!.message).toBe("Store URL is required to connect Shopify.");
  });

  it("treats empty string as missing", () => {
    const res = validateRequiredFields("Shopify", required, {
      api_key: "",
      store_url: "https://x.myshopify.com",
      from_domain: "mail.x.com",
    });
    expect(res!.field).toBe("api_key");
  });

  it("treats whitespace-only values as missing", () => {
    const res = validateRequiredFields("Shopify", required, {
      api_key: "   \t\n ",
      store_url: "https://x.myshopify.com",
      from_domain: "mail.x.com",
    });
    expect(res!.field).toBe("api_key");
  });

  it("falls back to the field key when no label is defined", () => {
    const res = validateRequiredFields("Postmark", required, {
      api_key: "k",
      store_url: "https://x.myshopify.com",
    });
    expect(res!.field).toBe("from_domain");
    expect(res!.message).toBe("from_domain is required to connect Postmark.");
  });

  it("propagates docsUrl into the SaveFailure when provided", () => {
    const res = validateRequiredFields("Shopify", required, {}, "https://docs.example.com/shopify");
    expect(res!.docsUrl).toBe("https://docs.example.com/shopify");
  });

  it("omits docsUrl when not provided", () => {
    const res = validateRequiredFields("Shopify", required, {});
    expect(res!.docsUrl).toBeUndefined();
  });

  it("returns null when the requiredFields list is empty", () => {
    expect(validateRequiredFields("Anything", [], {})).toBeNull();
  });

  it("produces a shape structurally equal to fail() with the same inputs", () => {
    const res = validateRequiredFields("Shopify", required, {}, "https://d");
    expect(res).toEqual(
      fail("missing_field", "API Key is required to connect Shopify.", {
        field: "api_key",
        hint: "Fill in every field marked with * and we'll verify the connection automatically.",
        docsUrl: "https://d",
      }),
    );
  });
});
