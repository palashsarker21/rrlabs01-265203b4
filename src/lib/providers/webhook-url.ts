/**
 * Build the public webhook URL that a customer pastes into their provider.
 *
 * Format: `${origin}/api/public/webhooks/${provider}/${integrationId}`
 *
 * On the browser we use `window.location.origin`. On the server we derive
 * from LOVABLE_PROJECT_ID / APP_URL. Both agree with the published site.
 */
export function webhookUrl(origin: string, providerCode: string, integrationId: string): string {
  return `${origin.replace(/\/+$/, "")}/api/public/webhooks/${providerCode}/${integrationId}`;
}

export function getBrowserOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}
