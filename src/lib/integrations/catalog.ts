/**
 * Public adapter metadata — safe to send to the browser.
 * User-entered secret field values get encrypted server-side; the metadata
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

// ============================================================================
// STORES
// ============================================================================
const shopify: AdapterInfo = {
  provider: "shopify",
  name: "Shopify",
  kind: "store",
  description: "Sync failed checkouts and subscription events from your Shopify store.",
  docsUrl: "https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens",
  fields: [
    { key: "store_url", label: "Store URL", type: "url", placeholder: "https://mystore.myshopify.com", required: true },
    { key: "admin_access_token", label: "Admin API access token", type: "password", placeholder: "shpat_…", required: true, secret: true },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", secret: true },
    { key: "api_version", label: "API version", type: "text", placeholder: "2024-10" },
  ],
};

const woocommerce: AdapterInfo = {
  provider: "woocommerce",
  name: "WooCommerce",
  kind: "store",
  description: "Read failed orders and subscription events from WooCommerce.",
  docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication",
  fields: [
    { key: "store_url", label: "Store URL", type: "url", placeholder: "https://mystore.com", required: true },
    { key: "consumer_key", label: "Consumer key", type: "password", placeholder: "ck_…", required: true, secret: true },
    { key: "consumer_secret", label: "Consumer secret", type: "password", placeholder: "cs_…", required: true, secret: true },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", secret: true },
  ],
};

const customStore: AdapterInfo = {
  provider: "custom_store",
  name: "Custom Store (REST API)",
  kind: "store",
  description: "Connect a bespoke commerce backend via REST.",
  fields: [
    { key: "store_name", label: "Store name", type: "text", required: true },
    { key: "base_url", label: "Base API URL", type: "url", placeholder: "https://api.mystore.com", required: true },
    {
      key: "auth_type",
      label: "Authentication type",
      type: "select",
      required: true,
      options: [
        { value: "bearer", label: "Bearer token" },
        { value: "api_key", label: "API key header" },
        { value: "basic", label: "Basic auth" },
      ],
    },
    { key: "api_key", label: "API key / bearer token", type: "password", required: true, secret: true },
    { key: "webhook_endpoint", label: "Webhook endpoint (yours)", type: "url" },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", secret: true },
  ],
};

// ============================================================================
// PAYMENT GATEWAYS
// ============================================================================
const stripe: AdapterInfo = {
  provider: "stripe",
  name: "Stripe",
  kind: "payment_gateway",
  description: "Read failed charges and subscription events to trigger recovery.",
  docsUrl: "https://dashboard.stripe.com/apikeys",
  fields: [
    { key: "secret_key", label: "Secret API key", type: "password", placeholder: "sk_live_… or sk_test_…", required: true, secret: true, help: "Restricted key with read access to charges, customers, and subscriptions." },
    { key: "publishable_key", label: "Publishable key", type: "text", placeholder: "pk_live_…" },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", placeholder: "whsec_…", secret: true },
  ],
};

const paypal: AdapterInfo = {
  provider: "paypal",
  name: "PayPal",
  kind: "payment_gateway",
  description: "Recover failed PayPal subscription billing agreements.",
  docsUrl: "https://developer.paypal.com/api/rest/authentication/",
  fields: [
    { key: "client_id", label: "Client ID", type: "text", required: true },
    { key: "client_secret", label: "Client secret", type: "password", required: true, secret: true },
    {
      key: "environment",
      label: "Environment",
      type: "select",
      required: true,
      options: [
        { value: "sandbox", label: "Sandbox" },
        { value: "live", label: "Live" },
      ],
    },
  ],
};

const paddle: AdapterInfo = {
  provider: "paddle",
  name: "Paddle",
  kind: "payment_gateway",
  description: "Recover failed Paddle Billing subscription payments.",
  docsUrl: "https://developer.paddle.com/api-reference/about/authentication",
  fields: [
    { key: "api_key", label: "API key", type: "password", placeholder: "pdl_live_apikey_…", required: true, secret: true },
    { key: "webhook_secret", label: "Notification webhook secret", type: "password", secret: true },
    {
      key: "environment",
      label: "Environment",
      type: "select",
      options: [
        { value: "sandbox", label: "Sandbox" },
        { value: "live", label: "Live" },
      ],
    },
  ],
};

const lemonSqueezy: AdapterInfo = {
  provider: "lemonsqueezy",
  name: "Lemon Squeezy",
  kind: "payment_gateway",
  description: "Recover failed Lemon Squeezy subscription renewals.",
  docsUrl: "https://docs.lemonsqueezy.com/api",
  fields: [
    { key: "api_key", label: "API key", type: "password", required: true, secret: true },
    { key: "store_id", label: "Store ID", type: "text", required: true },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", secret: true },
  ],
};

const adyen: AdapterInfo = {
  provider: "adyen",
  name: "Adyen",
  kind: "payment_gateway",
  description: "Recover failed Adyen recurring contract payments.",
  docsUrl: "https://docs.adyen.com/development-resources/api-authentication/",
  fields: [
    { key: "api_key", label: "API key", type: "password", required: true, secret: true },
    { key: "merchant_account", label: "Merchant account", type: "text", required: true },
    { key: "hmac_key", label: "HMAC key", type: "password", secret: true },
    {
      key: "environment",
      label: "Environment",
      type: "select",
      options: [
        { value: "test", label: "Test" },
        { value: "live", label: "Live" },
      ],
    },
  ],
};

const customGateway: AdapterInfo = {
  provider: "custom_gateway",
  name: "Custom Payment Gateway",
  kind: "payment_gateway",
  description: "Connect any REST-based payment gateway.",
  fields: [
    { key: "gateway_name", label: "Gateway name", type: "text", required: true },
    { key: "api_endpoint", label: "API endpoint", type: "url", required: true },
    { key: "api_key", label: "API key", type: "password", required: true, secret: true },
    { key: "webhook_secret", label: "Webhook signing secret", type: "password", secret: true },
  ],
};

// ============================================================================
// COMMUNICATION
// ============================================================================
const resend: AdapterInfo = {
  provider: "resend",
  name: "Resend",
  kind: "communication",
  description: "Send recovery emails from your verified sending domain.",
  docsUrl: "https://resend.com/api-keys",
  fields: [
    { key: "api_key", label: "Resend API key", type: "password", placeholder: "re_…", required: true, secret: true },
    { key: "from_email", label: "From address", type: "email", placeholder: "recovery@yourdomain.com", required: true },
    { key: "from_name", label: "From name", type: "text", placeholder: "Your Company" },
  ],
};

const sendgrid: AdapterInfo = {
  provider: "sendgrid",
  name: "SendGrid",
  kind: "communication",
  description: "Send recovery emails through SendGrid.",
  docsUrl: "https://app.sendgrid.com/settings/api_keys",
  fields: [
    { key: "api_key", label: "SendGrid API key", type: "password", placeholder: "SG.…", required: true, secret: true },
    { key: "from_email", label: "From address", type: "email", required: true },
    { key: "from_name", label: "From name", type: "text" },
  ],
};

const smtp: AdapterInfo = {
  provider: "smtp",
  name: "SMTP",
  kind: "communication",
  description: "Send recovery emails via any SMTP server.",
  fields: [
    { key: "host", label: "SMTP host", type: "text", placeholder: "smtp.example.com", required: true },
    { key: "port", label: "Port", type: "text", placeholder: "587", required: true },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true, secret: true },
    { key: "from_email", label: "From address", type: "email", required: true },
    { key: "from_name", label: "From name", type: "text" },
    {
      key: "secure",
      label: "Encryption",
      type: "select",
      options: [
        { value: "starttls", label: "STARTTLS (587)" },
        { value: "tls", label: "TLS (465)" },
        { value: "none", label: "None" },
      ],
    },
  ],
};

const whatsappCloud: AdapterInfo = {
  provider: "whatsapp_cloud",
  name: "WhatsApp (Meta Cloud API)",
  kind: "communication",
  description: "Send recovery messages via the official Meta Cloud API.",
  docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  fields: [
    { key: "access_token", label: "Permanent access token", type: "password", required: true, secret: true },
    { key: "phone_number_id", label: "Phone number ID", type: "text", required: true },
    { key: "waba_id", label: "WhatsApp Business Account ID", type: "text" },
    { key: "verify_token", label: "Webhook verify token", type: "password", secret: true },
    { key: "webhook_secret", label: "Webhook app secret", type: "password", secret: true },
  ],
};

export const ADAPTERS: AdapterInfo[] = [
  shopify,
  woocommerce,
  customStore,
  stripe,
  paypal,
  paddle,
  lemonSqueezy,
  adyen,
  customGateway,
  resend,
  sendgrid,
  smtp,
  whatsappCloud,
];

export function getAdapterInfo(provider: string): AdapterInfo | undefined {
  return ADAPTERS.find((a) => a.provider === provider);
}
