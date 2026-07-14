/**
 * Public adapter metadata — safe to send to the browser.
 * Field values entered by the user get encrypted server-side; the metadata
 * only describes shape (label, type, whether it's a secret, placeholder).
 */
export type IntegrationKind = "payment_gateway" | "communication" | "store";

export interface AdapterField {
  key: string;
  label: string;
  type: "text" | "password" | "email" | "url" | "select";
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface AdapterInfo {
  provider: string; // stable slug, e.g. "stripe"
  name: string; // human-facing
  kind: IntegrationKind;
  description: string;
  fields: AdapterField[];
  docsUrl?: string;
}

export const ADAPTERS: AdapterInfo[] = [
  {
    provider: "stripe",
    name: "Stripe",
    kind: "payment_gateway",
    description: "Read failed charges and subscription events to trigger recovery.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    fields: [
      {
        key: "secret_key",
        label: "Secret API key",
        type: "password",
        placeholder: "sk_live_… or sk_test_…",
        required: true,
        secret: true,
        help: "Restricted key with read access to charges, customers, and subscriptions.",
      },
      {
        key: "webhook_secret",
        label: "Webhook signing secret",
        type: "password",
        placeholder: "whsec_…",
        secret: true,
        help: "Optional — used to verify inbound webhook events from Stripe.",
      },
    ],
  },
  {
    provider: "resend",
    name: "Resend",
    kind: "communication",
    description: "Send recovery emails from your verified sending domain.",
    docsUrl: "https://resend.com/api-keys",
    fields: [
      {
        key: "api_key",
        label: "Resend API key",
        type: "password",
        placeholder: "re_…",
        required: true,
        secret: true,
      },
      {
        key: "from_email",
        label: "From address",
        type: "email",
        placeholder: "recovery@yourdomain.com",
        required: true,
      },
      {
        key: "from_name",
        label: "From name",
        type: "text",
        placeholder: "Your Company",
      },
    ],
  },
  {
    provider: "whatsapp_cloud",
    name: "WhatsApp (Meta Cloud API)",
    kind: "communication",
    description: "Send recovery messages via the official Meta Cloud API.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    fields: [
      {
        key: "access_token",
        label: "Permanent access token",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "phone_number_id",
        label: "Phone number ID",
        type: "text",
        required: true,
      },
      {
        key: "waba_id",
        label: "WhatsApp Business Account ID",
        type: "text",
      },
    ],
  },
];

export function getAdapterInfo(provider: string): AdapterInfo | undefined {
  return ADAPTERS.find((a) => a.provider === provider);
}
