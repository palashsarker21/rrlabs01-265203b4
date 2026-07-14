import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric AES-256-GCM encryption for integration credentials.
 * Server-only. Never import this file from browser code.
 *
 * The key is derived by SHA-256 from RRLABS_ENCRYPTION_KEY so the raw secret
 * can be any length; the derived key is always 32 bytes.
 */
function key(): Buffer {
  const raw = process.env.RRLABS_ENCRYPTION_KEY;
  if (!raw) throw new Error("RRLABS_ENCRYPTION_KEY is not set");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptJSON(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptJSON<T = unknown>(stored: string): T {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
