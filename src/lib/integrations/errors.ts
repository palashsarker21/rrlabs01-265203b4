/**
 * Structured error codes for `saveIntegration`.
 *
 * The server returns these on the `{ ok: false }` branch (never thrown) so
 * the client can render field-level, actionable feedback with a docs link
 * instead of a generic toast. All fields except `code` and `message` are
 * optional.
 */

export type SaveErrorCode =
  | "missing_field"
  | "invalid_field"
  | "unknown_provider"
  | "provider_disabled"
  | "permission_denied"
  | "plan_limit"
  | "provider_rejected"
  | "internal";

export type SaveFailure = {
  ok: false;
  message: string;
  code: SaveErrorCode;
  /** Field key from `setup_fields` that caused the failure, if applicable. */
  field?: string;
  /** Short, human-readable next step. */
  hint?: string;
  /** Provider docs / upgrade link when relevant. */
  docsUrl?: string;
};

export type SaveSuccess = { ok: true; message: string };

export type SaveResult = SaveSuccess | SaveFailure;

export function fail(
  code: SaveErrorCode,
  message: string,
  extra?: Partial<Omit<SaveFailure, "ok" | "code" | "message">>,
): SaveFailure {
  return { ok: false, code, message, ...(extra ?? {}) };
}
