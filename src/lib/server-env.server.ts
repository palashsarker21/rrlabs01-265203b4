/**
 * Server-only environment validation.
 *
 * Never import from client code. Reads process.env inside functions only —
 * never at module scope of shared files. Never logs or returns raw values.
 */

const REQUIRED_SERVER_SECRETS = ["RRLABS_ENCRYPTION_KEY", "OPEN_ROUTER_API_KEY"] as const;

export type ServerEnvReport = {
  ok: boolean;
  missing: string[];
  present: string[];
};

export function checkRequiredServerEnv(): ServerEnvReport {
  const missing: string[] = [];
  const present: string[] = [];
  for (const name of REQUIRED_SERVER_SECRETS) {
    if (process.env[name] && process.env[name]!.length > 0) present.push(name);
    else missing.push(name);
  }
  return { ok: missing.length === 0, missing, present };
}

/**
 * Fail-fast assertion for handlers that require the platform secrets.
 * Never includes secret values in the thrown message.
 */
export function assertRequiredServerEnv(): void {
  const r = checkRequiredServerEnv();
  if (!r.ok) {
    throw new Error(
      `Server misconfigured: missing required environment variable(s): ${r.missing.join(", ")}`,
    );
  }
}
