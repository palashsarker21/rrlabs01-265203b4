/**
 * DebugErrorPanel — full-diagnostic error panel used in debug mode.
 *
 * Renders EVERYTHING we can derive from a thrown value so no error is
 * ever hidden behind a generic "Something went wrong" message:
 *  - Title / message / stack / cause
 *  - Inferred file : line : column and function name (parsed from the stack)
 *  - Component name (from React error boundary info)
 *  - Route (current pathname + search)
 *  - HTTP status / endpoint / method (for fetch / Response / Supabase errors)
 *  - Request payload + response body (when attached to the error)
 *  - Supabase / Postgres error fields (code, hint, details, message)
 *  - Auth / OAuth details (provider, redirect, session state)
 *  - Missing environment variable name (when the message says so)
 *  - Suggested fix based on the classified error kind
 *
 * The panel is safe to render in production too — it never renders
 * secrets from `process.env`; it only surfaces information that is
 * already attached to the thrown value or the current URL.
 */

import { useMemo, useState } from "react";
import { AlertOctagon, ChevronDown, ChevronRight, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeError, type NormalizedError } from "@/lib/errors/normalize";

type DebugFields = {
  title: string;
  message: string;
  name?: string;
  stack?: string;
  fileName?: string;
  lineNumber?: string;
  columnNumber?: string;
  functionName?: string;
  componentName?: string;
  componentStack?: string;
  route?: string;
  method?: string;
  endpoint?: string;
  httpStatus?: number;
  requestPayload?: unknown;
  responseBody?: unknown;
  supabaseCode?: string;
  supabaseHint?: string;
  supabaseDetails?: string;
  authProvider?: string;
  redirectUrl?: string;
  callbackUrl?: string;
  missingEnv?: string;
  cause?: unknown;
  normalized: NormalizedError;
  raw: unknown;
};

const STACK_FRAME_RE =
  /at\s+(?:(?<fn>[^\s()]+)\s+)?\(?(?<file>[^\s()]+):(?<line>\d+):(?<col>\d+)\)?/;

function parseTopFrame(stack?: string) {
  if (!stack) return {};
  const lines = stack.split("\n");
  for (const l of lines) {
    const m = l.match(STACK_FRAME_RE);
    if (m?.groups) {
      return {
        functionName: m.groups.fn,
        fileName: m.groups.file,
        lineNumber: m.groups.line,
        columnNumber: m.groups.col,
      };
    }
  }
  return {};
}

function firstComponentFromStack(componentStack?: string) {
  if (!componentStack) return undefined;
  const m = componentStack
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.startsWith("at ") || s.startsWith("in "));
  if (!m) return undefined;
  return m.replace(/^(at|in)\s+/, "").split(/\s|\(/)[0];
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function extract(error: unknown, componentStack?: string): DebugFields {
  const normalized = normalizeError(error);
  const route =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

  const base: DebugFields = {
    title: normalized.title,
    message: normalized.message,
    normalized,
    raw: error,
    route,
    componentStack,
    componentName: firstComponentFromStack(componentStack),
  };

  if (error instanceof Error) {
    base.name = error.name;
    base.stack = error.stack;
    base.cause = (error as { cause?: unknown }).cause;
    Object.assign(base, parseTopFrame(error.stack));
  }

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;

    // Missing env var — very common failure mode we want to surface loud.
    const msg = typeof e.message === "string" ? e.message : "";
    const envMatch = msg.match(
      /(?:missing|not set|is required|undefined)[^A-Z0-9_]*([A-Z][A-Z0-9_]{3,})/,
    );
    if (envMatch) base.missingEnv = envMatch[1];

    base.httpStatus =
      (typeof e.status === "number" ? e.status : undefined) ??
      (typeof e.statusCode === "number" ? e.statusCode : undefined);
    base.endpoint = pickString(e, "url", "endpoint", "path");
    base.method = pickString(e, "method");
    base.requestPayload = e.requestBody ?? e.payload ?? e.body;
    base.responseBody = e.responseBody ?? e.response ?? e.data;

    // Supabase / PostgREST style fields
    base.supabaseCode = pickString(e, "code");
    base.supabaseHint = pickString(e, "hint");
    base.supabaseDetails = pickString(e, "details");

    // Supabase Auth / OAuth style fields
    base.authProvider = pickString(e, "provider");
    base.redirectUrl = pickString(e, "redirectTo", "redirect_url", "redirectUrl");
    base.callbackUrl = pickString(e, "callbackUrl", "callback_url");
  }

  return base;
}

function stringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function suggestFix(f: DebugFields): string {
  if (f.missingEnv) {
    return `Environment variable \`${f.missingEnv}\` is not set. Add it to your project secrets (server-side) or as a VITE_ prefixed variable (client-side), then redeploy.`;
  }
  switch (f.normalized.kind) {
    case "authentication":
      return "Session is missing or expired. Sign in again, or check that `attachSupabaseAuth` middleware is registered in `src/start.ts`.";
    case "authorization":
      return "The signed-in user doesn't satisfy the RLS policy or role check. Verify `user_roles`, `workspace_members`, or the `has_role`/`is_super_admin` policy for this resource.";
    case "not_found":
      return "The requested resource doesn't exist. Verify the route path, the record ID, and any RLS policy that could be filtering it out.";
    case "rate_limit":
      return "You are hitting a rate limit. Back off and retry, or raise the provider's rate limit.";
    case "validation":
      return "Input failed schema validation. Check the `inputValidator` / Zod schema on this server function against the payload above.";
    case "database":
      return "Database rejected the query. Check the Supabase error code above against the RLS policies and GRANTs on the target table.";
    case "provider":
      return "A third-party provider (Stripe / LemonSqueezy / Resend / WhatsApp / AI) returned an error. Check the response body and provider dashboard.";
    case "network":
      return "The request never reached the server. Check the endpoint URL, CORS, and that the dev server / edge worker is running.";
    case "timeout":
      return "The request exceeded its timeout. Optimize the query or raise the timeout.";
    default:
      return "Read the stack trace above — the top frame points to the exact file and line to fix.";
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-destructive/10 py-1.5 text-xs">
      <div className="font-mono uppercase tracking-wide text-destructive/80">{label}</div>
      <div className="min-w-0 break-words font-mono text-foreground/90">{value}</div>
    </div>
  );
}

function Block({
  label,
  value,
  defaultOpen = false,
}: {
  label: string;
  value: string | undefined;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!value) return null;
  return (
    <div className="mt-2 rounded-md border border-destructive/20 bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-destructive/80"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all px-3 pb-3 text-[11px] leading-relaxed text-foreground/90">
          {value}
        </pre>
      )}
    </div>
  );
}

export function DebugErrorPanel({
  error,
  componentStack,
  onRetry,
  boundary,
}: {
  error: unknown;
  componentStack?: string;
  onRetry?: () => void;
  boundary?: string;
}) {
  const fields = useMemo(() => extract(error, componentStack), [error, componentStack]);
  const suggestion = suggestFix(fields);

  const copyAll = () => {
    const payload = {
      boundary,
      route: fields.route,
      title: fields.title,
      name: fields.name,
      message: fields.message,
      httpStatus: fields.httpStatus,
      endpoint: fields.endpoint,
      method: fields.method,
      fileName: fields.fileName,
      lineNumber: fields.lineNumber,
      columnNumber: fields.columnNumber,
      functionName: fields.functionName,
      componentName: fields.componentName,
      supabaseCode: fields.supabaseCode,
      supabaseHint: fields.supabaseHint,
      supabaseDetails: fields.supabaseDetails,
      authProvider: fields.authProvider,
      redirectUrl: fields.redirectUrl,
      callbackUrl: fields.callbackUrl,
      missingEnv: fields.missingEnv,
      requestPayload: fields.requestPayload,
      responseBody: fields.responseBody,
      stack: fields.stack,
      componentStack: fields.componentStack,
      cause: fields.cause,
      kind: fields.normalized.kind,
      code: fields.normalized.code,
    };
    void navigator.clipboard?.writeText(stringify(payload));
  };

  // Log the full error to browser console + network response (visible in
  // devtools) as required by production debug mode.
  if (typeof window !== "undefined") {
    console.group(`%c[RRLabs Debug] ${fields.name ?? "Error"}: ${fields.message}`, "color:#ef4444");

    console.error(fields.raw);
    if (fields.stack) console.error(fields.stack);
    if (fields.componentStack) console.error("Component stack:", fields.componentStack);

    console.groupEnd();
  }

  return (
    <div
      role="alert"
      className="mx-auto my-6 max-w-3xl rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-left shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
              {fields.normalized.kind}
            </span>
            {fields.httpStatus && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-mono text-destructive">
                HTTP {fields.httpStatus}
              </span>
            )}
            {boundary && (
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {boundary}
              </span>
            )}
          </div>
          <h2 className="mt-1 break-words text-lg font-semibold text-foreground">
            {fields.name ? `${fields.name}: ` : ""}
            {fields.message || fields.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-destructive">Why: </span>
            {suggestion}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Row label="Route" value={fields.route} />
        <Row label="Component" value={fields.componentName} />
        <Row label="File" value={fields.fileName} />
        <Row
          label="Location"
          value={
            fields.lineNumber
              ? `line ${fields.lineNumber}${fields.columnNumber ? `:${fields.columnNumber}` : ""}`
              : undefined
          }
        />
        <Row label="Function" value={fields.functionName} />
        <Row label="Method" value={fields.method} />
        <Row label="Endpoint" value={fields.endpoint} />
        <Row label="HTTP status" value={fields.httpStatus} />
        <Row label="Code" value={fields.normalized.code} />
        <Row label="Supabase code" value={fields.supabaseCode} />
        <Row label="Supabase hint" value={fields.supabaseHint} />
        <Row label="Supabase details" value={fields.supabaseDetails} />
        <Row label="OAuth provider" value={fields.authProvider} />
        <Row label="Redirect URL" value={fields.redirectUrl} />
        <Row label="Callback URL" value={fields.callbackUrl} />
        <Row label="Missing env" value={fields.missingEnv} />
      </div>

      <Block label="Stack trace" value={fields.stack} defaultOpen />
      <Block label="Component stack" value={fields.componentStack} />
      <Block label="Request payload" value={stringify(fields.requestPayload)} />
      <Block label="Response body" value={stringify(fields.responseBody)} />
      <Block
        label="Cause"
        value={fields.cause === undefined ? undefined : stringify(fields.cause)}
      />
      <Block label="Raw error object" value={stringify(fields.raw)} />

      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={copyAll}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy diagnostics
        </Button>
      </div>
    </div>
  );
}
