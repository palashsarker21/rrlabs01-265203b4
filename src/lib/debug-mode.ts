/**
 * Production Debug Mode
 *
 * Controls whether the app renders full diagnostic error information
 * (stack traces, file:line, request/response bodies, Supabase error codes,
 * etc.) instead of sanitized fallbacks.
 *
 * Enabled when:
 *   - `import.meta.env.DEV` is true (Vite dev), OR
 *   - `localStorage.rrlabs_debug === "1"` (opt-in on any deployed build), OR
 *   - `window.__RRLABS_DEBUG__ === true` (programmatic toggle)
 *
 * Toggle from the browser console:
 *   localStorage.setItem("rrlabs_debug", "1"); location.reload();
 *   localStorage.removeItem("rrlabs_debug"); location.reload();
 */

declare global {
  interface Window {
    __RRLABS_DEBUG__?: boolean;
  }
}

export function isDebugMode(): boolean {
  if (typeof window === "undefined") {
    // Server: honor NODE_ENV / DEBUG env
    return (
      process.env.NODE_ENV !== "production" ||
      process.env.RRLABS_DEBUG === "1" ||
      process.env.DEBUG === "1"
    );
  }
  if (window.__RRLABS_DEBUG__ === true) return true;
  try {
    if (window.localStorage?.getItem("rrlabs_debug") === "1") return true;
  } catch {
    /* storage blocked */
  }
  // Vite injects import.meta.env.DEV at build time
  return Boolean(import.meta.env?.DEV);
}

export function setDebugMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem("rrlabs_debug", "1");
    else window.localStorage.removeItem("rrlabs_debug");
  } catch {
    /* ignore */
  }
  window.__RRLABS_DEBUG__ = enabled;
}
