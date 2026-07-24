import { useEffect } from "react";

/**
 * Tawk.to Live Chat widget loader.
 * Injects the embed script exactly once, asynchronously, after mount.
 * Fails silently in production; logs in development.
 */
const TAWK_SRC = "https://embed.tawk.to/6a62db540a6ade1d4a334bc9/1ju92hhqr";
const SCRIPT_ID = "tawk-to-embed";

declare global {
  interface Window {
    Tawk_API?: Record<string, unknown>;
    Tawk_LoadStart?: Date;
  }
}

export function TawkChat() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (document.getElementById(SCRIPT_ID)) return;

    try {
      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_LoadStart = new Date();

      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.async = true;
      s.src = TAWK_SRC;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      s.onerror = () => {
        if (import.meta.env.DEV) {
          console.warn("[TawkChat] failed to load widget");
        }
      };
      document.head.appendChild(s);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[TawkChat] injection error", err);
      }
    }
  }, []);

  return null;
}

export default TawkChat;
