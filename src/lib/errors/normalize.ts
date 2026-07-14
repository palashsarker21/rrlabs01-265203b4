/**
 * Central error classifier. Turns any thrown value into a normalized,
 * user-safe error object suitable for toasts, inline UI, or logging.
 * Server-only details (stack, cause) stay on the server; only the safe
 * fields are ever rendered to the user.
 */

export type ErrorKind =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "rate_limit"
  | "network"
  | "timeout"
  | "provider"
  | "database"
  | "server"
  | "unknown";

export interface NormalizedError {
  kind: ErrorKind;
  code: string;
  status: number;
  title: string;
  message: string;
  retryable: boolean;
  field?: string;
}

const TITLES: Record<ErrorKind, string> = {
  validation: "Please check your input",
  authentication: "Signed out",
  authorization: "You don't have access to this",
  not_found: "We couldn't find that",
  rate_limit: "Too many requests",
  network: "Network problem",
  timeout: "Request timed out",
  provider: "A service we rely on is having trouble",
  database: "Database is unavailable",
  server: "Something went wrong on our end",
  unknown: "Something went wrong",
};

const RETRYABLE: ErrorKind[] = [
  "network",
  "timeout",
  "provider",
  "database",
  "server",
  "rate_limit",
];

function classifyStatus(status: number): ErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status === 503 || status === 502 || status === 504) return "provider";
  if (status >= 500) return "server";
  return "unknown";
}

function classifyMessage(msg: string): ErrorKind | undefined {
  const m = msg.toLowerCase();
  if (m.includes("unauthorized") || m.includes("jwt") || m.includes("no authorization"))
    return "authentication";
  if (m.includes("forbidden") || m.includes("not authorized")) return "authorization";
  if (m.includes("not found")) return "not_found";
  if (m.includes("rate limit") || m.includes("too many")) return "rate_limit";
  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout")) return "timeout";
  if (
    m.includes("network") ||
    m.includes("fetch failed") ||
    m.includes("econnrefused") ||
    m.includes("failed to fetch")
  )
    return "network";
  if (m.includes("validation") || m.includes("invalid")) return "validation";
  if (
    m.includes("supabase") ||
    m.includes("postgres") ||
    m.includes("row-level security") ||
    m.includes("rls")
  )
    return "database";
  if (
    m.includes("stripe") ||
    m.includes("lemonsqueezy") ||
    m.includes("resend") ||
    m.includes("whatsapp") ||
    m.includes("gemini") ||
    m.includes("openai")
  )
    return "provider";
  return undefined;
}

export function normalizeError(error: unknown): NormalizedError {
  // Response objects (fetch)
  if (typeof Response !== "undefined" && error instanceof Response) {
    const kind = classifyStatus(error.status);
    return {
      kind,
      code: `HTTP_${error.status}`,
      status: error.status,
      title: TITLES[kind],
      message: error.statusText || TITLES[kind],
      retryable: RETRYABLE.includes(kind),
    };
  }

  // Objects with structured shape { status, message, code, field }
  if (error && typeof error === "object") {
    const e = error as {
      status?: number;
      statusCode?: number;
      code?: string;
      message?: string;
      field?: string;
      name?: string;
    };
    const status = e.status ?? e.statusCode;
    const msg = typeof e.message === "string" ? e.message : "";
    const byMsg = classifyMessage(msg);
    const kind = typeof status === "number" ? classifyStatus(status) : (byMsg ?? "unknown");
    return {
      kind,
      code: e.code ?? (typeof status === "number" ? `HTTP_${status}` : (e.name ?? "ERR_UNKNOWN")),
      status: status ?? 500,
      title: TITLES[kind],
      message: userSafeMessage(kind, msg),
      retryable: RETRYABLE.includes(kind),
      field: e.field,
    };
  }

  if (typeof error === "string") {
    const kind = classifyMessage(error) ?? "unknown";
    return {
      kind,
      code: "ERR_STRING",
      status: 500,
      title: TITLES[kind],
      message: userSafeMessage(kind, error),
      retryable: RETRYABLE.includes(kind),
    };
  }

  return {
    kind: "unknown",
    code: "ERR_UNKNOWN",
    status: 500,
    title: TITLES.unknown,
    message: "An unexpected error happened. Please try again.",
    retryable: true,
  };
}

function userSafeMessage(kind: ErrorKind, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return TITLES[kind];
  // strip stack-trace-like content and internal paths
  if (trimmed.length > 240) return TITLES[kind];
  if (/\bat\s+\S+:\d+:\d+/.test(trimmed)) return TITLES[kind];
  if (/\/(?:src|node_modules)\//.test(trimmed)) return TITLES[kind];
  return trimmed;
}

/**
 * Wrap a server-function handler to log full details server-side and
 * re-throw a normalized error the client can safely render.
 */
export function wrapServerError(
  err: unknown,
  ctx: { route?: string; userId?: string; workspaceId?: string; requestId?: string } = {},
): NormalizedError {
  const normalized = normalizeError(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // Structured server log — never sent to the client.
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      level: "error",
      code: normalized.code,
      kind: normalized.kind,
      status: normalized.status,
      message: err instanceof Error ? err.message : String(err),
      stack,
      ...ctx,
    }),
  );
  return normalized;
}
