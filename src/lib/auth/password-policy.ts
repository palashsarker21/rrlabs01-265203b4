/**
 * Password policy for RRLabs auth flows.
 * Single source of truth used by sign-up, password reset, and change-password.
 */

export interface PasswordRule {
  id: "length" | "upper" | "lower" | "number" | "special";
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export interface PasswordEvaluation {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  passed: Set<PasswordRule["id"]>;
  strong: boolean;
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong" | "Excellent";
}

export function evaluatePassword(pw: string): PasswordEvaluation {
  const passed = new Set<PasswordRule["id"]>();
  for (const r of PASSWORD_RULES) if (r.test(pw)) passed.add(r.id);
  const score = passed.size as PasswordEvaluation["score"];
  const strong = score === PASSWORD_RULES.length;
  const label = (
    ["Too weak", "Weak", "Fair", "Good", "Strong", "Excellent"] as const
  )[score];
  return { score, passed, strong, label };
}

/** Same-origin path validator — prevents open-redirect. */
export function safeRedirectPath(input?: string, fallback = "/app"): string {
  if (!input) return fallback;
  try {
    if (input.startsWith("/") && !input.startsWith("//")) return input;
    if (typeof window !== "undefined") {
      const u = new URL(input, window.location.origin);
      if (u.origin === window.location.origin) return u.pathname + u.search;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Generate a cryptographically strong password that satisfies every rule.
 * Uses window.crypto.getRandomValues when available; falls back to Math.random.
 */
export function generateStrongPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%^&*()-_=+[]{}";
  const all = upper + lower + digits + specials;
  const size = Math.max(12, length);

  const pick = (set: string, n: number): string => {
    const out: string[] = [];
    const buf = new Uint32Array(n);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
    }
    for (let i = 0; i < n; i++) out.push(set[buf[i] % set.length]);
    return out.join("");
  };

  const seeds = pick(upper, 1) + pick(lower, 1) + pick(digits, 1) + pick(specials, 1);
  const rest = pick(all, size - seeds.length);
  const merged = (seeds + rest).split("");
  // Fisher-Yates shuffle with crypto randomness
  for (let i = merged.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      globalThis.crypto.getRandomValues(r);
    } else {
      r[0] = Math.floor(Math.random() * 0xffffffff);
    }
    const j = r[0] % (i + 1);
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  return merged.join("");
}

export const CONSENT_VERSION = "2026-01";
