import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed, short-lived grant that binds an activation retry to the exact set
 * of step IDs shown in the confirmation dialog. Prevents a tampered client
 * from re-running steps the user did not approve.
 *
 * Payload (base64url): { w: workspaceId, s: sortedStepIds, n: nonce, e: expMs }
 * Signature: HMAC-SHA256(payload, RRLABS_ENCRYPTION_KEY)
 * Wire format: "<payloadB64>.<sigB64>"
 */

export type ActivationStepId =
  | "permission"
  | "required"
  | "verified"
  | "webhooks"
  | "activate";

export const ACTIVATION_STEP_IDS: readonly ActivationStepId[] = [
  "permission",
  "required",
  "verified",
  "webhooks",
  "activate",
];

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface GrantPayload {
  w: string;
  s: ActivationStepId[];
  n: string;
  e: number;
}

function getKey(): Buffer {
  const key = process.env.RRLABS_ENCRYPTION_KEY;
  if (!key) throw new Error("Activation grant key is not configured.");
  return Buffer.from(key, "utf8");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function issueRetryGrant(input: {
  workspaceId: string;
  allowedStepIds: ActivationStepId[];
}): { token: string; expiresAt: string; allowedStepIds: ActivationStepId[] } {
  const sorted = [...new Set(input.allowedStepIds)].sort(
    (a, b) => ACTIVATION_STEP_IDS.indexOf(a) - ACTIVATION_STEP_IDS.indexOf(b),
  );
  const payload: GrantPayload = {
    w: input.workspaceId,
    s: sorted,
    n: randomBytes(12).toString("hex"),
    e: Date.now() + TTL_MS,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", getKey()).update(payloadB64).digest();
  const token = `${payloadB64}.${b64url(sig)}`;
  return { token, expiresAt: new Date(payload.e).toISOString(), allowedStepIds: sorted };
}

export type GrantVerifyResult =
  | { ok: true; workspaceId: string; allowedStepIds: ActivationStepId[]; expiresAt: number }
  | { ok: false; reason: string };

export function verifyRetryGrant(token: string, workspaceId: string): GrantVerifyResult {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "Malformed retry grant." };
  }
  const [payloadB64, sigB64] = token.split(".", 2);
  if (!payloadB64 || !sigB64) return { ok: false, reason: "Malformed retry grant." };

  const expectedSig = createHmac("sha256", getKey()).update(payloadB64).digest();
  const providedSig = b64urlDecode(sigB64);
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    return { ok: false, reason: "Invalid retry grant signature." };
  }

  let payload: GrantPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as GrantPayload;
  } catch {
    return { ok: false, reason: "Invalid retry grant payload." };
  }

  if (!payload || typeof payload.w !== "string" || !Array.isArray(payload.s)) {
    return { ok: false, reason: "Invalid retry grant payload." };
  }
  if (payload.w !== workspaceId) {
    return { ok: false, reason: "Retry grant does not match this workspace." };
  }
  if (typeof payload.e !== "number" || payload.e <= Date.now()) {
    return { ok: false, reason: "Retry grant has expired. Please retry again." };
  }
  const allowed = payload.s.filter((id): id is ActivationStepId =>
    (ACTIVATION_STEP_IDS as readonly string[]).includes(id),
  );
  if (allowed.length !== payload.s.length || allowed.length === 0) {
    return { ok: false, reason: "Retry grant contains unknown step IDs." };
  }
  return { ok: true, workspaceId: payload.w, allowedStepIds: allowed, expiresAt: payload.e };
}
