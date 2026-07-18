import { fail, type SaveFailure } from "./errors";

export type RequiredField = { key: string; label?: string };

/**
 * Pure validator for the "missing required field" branch of `saveIntegration`.
 * Mirrors the check in the server function so it can be unit-tested without
 * touching the DB or auth. Returns the first-missing failure, or `null`.
 *
 * A credential value counts as "present" only when it stringifies to a
 * non-empty trimmed value — matching the server rule
 * `!data.credentials[field.key]?.toString().trim()`.
 */
export function validateRequiredFields(
  providerName: string,
  requiredFields: readonly RequiredField[],
  credentials: Record<string, string>,
  docsUrl?: string,
): SaveFailure | null {
  for (const field of requiredFields) {
    const raw = credentials[field.key];
    if (!raw?.toString().trim()) {
      return fail(
        "missing_field",
        `${field.label ?? field.key} is required to connect ${providerName}.`,
        {
          field: field.key,
          hint: "Fill in every field marked with * and we'll verify the connection automatically.",
          docsUrl,
        },
      );
    }
  }
  return null;
}
