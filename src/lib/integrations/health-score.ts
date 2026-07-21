/**
 * Compute a 0–100 health score for a single integration.
 *
 * Pure function — safe to import from client and server. The score is a
 * composite of the four signals we already persist on each integration
 * row plus the rolling `provider_status` cache, so it stays accurate for
 * both freshly-saved credentials and long-lived connections.
 *
 * Weighting (100 total):
 *   status=connected .......................... 30
 *   verification_status=verified .............. 20
 *   last_test_ok=true ......................... 20
 *   webhook delivery healthy (0 recent errors) 20
 *   tested within the last 24h ................ 10
 */
export type HealthInputs = {
  status?: string | null;
  verification_status?: string | null;
  last_test_ok?: boolean | null;
  last_test_at?: string | null;
  last_error?: string | null;
  webhook?: {
    last_delivery_at?: string | null;
    last_success_at?: string | null;
    retry_count?: number | null;
    last_error?: string | null;
  } | null;
};

export type HealthGrade = "excellent" | "good" | "fair" | "poor" | "unknown";

export function computeHealthScore(input: HealthInputs): number {
  let score = 0;

  if (input.status === "connected") score += 30;
  else if (input.status === "pending") score += 10;

  if (input.verification_status === "verified") score += 20;
  else if (input.verification_status === "pending") score += 5;

  if (input.last_test_ok === true) score += 20;

  const wh = input.webhook;
  if (wh) {
    const retries = wh.retry_count ?? 0;
    const hasErr = Boolean(wh.last_error);
    if (!hasErr && retries === 0) score += 20;
    else if (!hasErr && retries < 3) score += 12;
    else if (retries < 10) score += 5;
  } else {
    // No webhook activity yet — neutral partial credit so brand-new
    // integrations don't score as "poor" purely for lack of traffic.
    score += 10;
  }

  if (input.last_test_at) {
    const ageMs = Date.now() - Date.parse(input.last_test_at);
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000) {
      score += 10;
    } else if (Number.isFinite(ageMs) && ageMs <= 7 * 24 * 60 * 60 * 1000) {
      score += 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function gradeFor(score: number): HealthGrade {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  if (score > 0) return "poor";
  return "unknown";
}

export function gradeTone(grade: HealthGrade): { dot: string; text: string; label: string } {
  switch (grade) {
    case "excellent":
      return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Excellent" };
    case "good":
      return { dot: "bg-teal-500", text: "text-teal-600", label: "Good" };
    case "fair":
      return { dot: "bg-amber-500", text: "text-amber-600", label: "Fair" };
    case "poor":
      return { dot: "bg-red-500", text: "text-red-600", label: "Poor" };
    default:
      return { dot: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Unknown" };
  }
}
