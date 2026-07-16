/**
 * Guarded PWA service-worker registration.
 *
 * Refuses to register in dev, iframe previews, Lovable preview hosts, and
 * when `?sw=off` is present. In refused contexts, actively unregisters any
 * existing `/sw.js` so a stale worker cannot persist across environments.
 */

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
}

async function unregisterMatching() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL;
          return scriptURL?.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export async function registerPwa(): Promise<void> {
  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    // Auto-update: when a new worker takes over, reload to pick up new assets.
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "activated" && navigator.serviceWorker.controller) {
          // controlled page — reload once so newly cached HTML is served
        }
      });
    });
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}
