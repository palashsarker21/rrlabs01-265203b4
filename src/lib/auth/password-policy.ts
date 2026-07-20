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
