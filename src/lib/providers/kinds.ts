/**
 * Client-safe provider kind mapping.
 *
 * The DB `provider_catalog.kind` uses a 4-way split:
 *   store | gateway | email | messaging
 *
 * The existing `integrations.kind` enum uses a 3-way split:
 *   store | payment_gateway | communication
 *
 * The 4-way split is what we render in the Integration Center (each step
 * is one kind). The 3-way split is what the `integrations` table stores.
 */

export type ProviderKind = "store" | "gateway" | "email" | "messaging";
export type IntegrationKind = "store" | "payment_gateway" | "communication";

export function integrationKindFor(kind: ProviderKind): IntegrationKind {
  switch (kind) {
    case "store":
      return "store";
    case "gateway":
      return "payment_gateway";
    case "email":
    case "messaging":
      return "communication";
  }
}

export const PROVIDER_STEP_ORDER: {
  kind: ProviderKind;
  title: string;
  description: string;
}[] = [
  {
    kind: "store",
    title: "Store connection",
    description: "Connect the storefront or membership platform where your customers pay.",
  },
  {
    kind: "gateway",
    title: "Payment gateway",
    description:
      "Connect the processor that charges your customers so we can hear failed payments.",
  },
  {
    kind: "email",
    title: "Email delivery",
    description: "Pick the email service RRLabs uses to send recovery emails.",
  },
  {
    kind: "messaging",
    title: "WhatsApp & SMS",
    description: "Optional — reach customers on WhatsApp or SMS when email is not enough.",
  },
];
