/**
 * Failure classifier — maps raw gateway decline/error codes onto our canonical
 * failure_classification enum. Pure function, deterministic, no AI. Callers
 * should invoke this synchronously right after a webhook is verified so the
 * downstream decision engine and template matcher have a stable key.
 *
 * Backwards compatible: never throws. Unknown codes fall back to "unknown".
 */

export type FailureClassification =
  | "soft_decline"
  | "hard_decline"
  | "expired_card"
  | "insufficient_funds"
  | "auth_required"
  | "incorrect_cvc"
  | "fraud_suspected"
  | "temporary_bank"
  | "gateway_timeout"
  | "network_error"
  | "unknown";

interface ClassifyInput {
  provider?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  decline_code?: string | null;
  network_status?: string | null;
}

const NORMALISE = (s?: string | null) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// Stripe/LS decline_code + failure_code map. Extend liberally — misses fall
// through to a heuristic based on the human-readable message.
const CODE_MAP: Record<string, FailureClassification> = {
  // Expired
  expired_card: "expired_card",
  card_expired: "expired_card",
  // Insufficient funds
  insufficient_funds: "insufficient_funds",
  not_sufficient_funds: "insufficient_funds",
  // Auth required (3DS)
  authentication_required: "auth_required",
  auth_required: "auth_required",
  three_d_secure_required: "auth_required",
  // CVC
  incorrect_cvc: "incorrect_cvc",
  invalid_cvc: "incorrect_cvc",
  // Fraud
  fraudulent: "fraud_suspected",
  fraud_suspected: "fraud_suspected",
  suspected_fraud: "fraud_suspected",
  stolen_card: "fraud_suspected",
  lost_card: "fraud_suspected",
  pickup_card: "fraud_suspected",
  // Hard declines
  do_not_honor: "hard_decline",
  generic_decline: "hard_decline",
  invalid_account: "hard_decline",
  card_not_supported: "hard_decline",
  currency_not_supported: "hard_decline",
  // Soft declines
  card_declined: "soft_decline",
  try_again_later: "soft_decline",
  processing_error: "soft_decline",
  // Temporary bank
  issuer_not_available: "temporary_bank",
  bank_offline: "temporary_bank",
  // Timeouts / network
  gateway_timeout: "gateway_timeout",
  request_timeout: "gateway_timeout",
  network_error: "network_error",
  processor_network_error: "network_error",
};

const MESSAGE_HEURISTICS: Array<[RegExp, FailureClassification]> = [
  [/expired|expiry|expiration/i, "expired_card"],
  [/insufficient|not\s*enough\s*funds|nsf/i, "insufficient_funds"],
  [/authentication|3ds|3-?d\s*secure|verify/i, "auth_required"],
  [/cvc|cvv|security\s*code/i, "incorrect_cvc"],
  [/fraud|stolen|lost\s*card|pickup/i, "fraud_suspected"],
  [/timeout|timed\s*out/i, "gateway_timeout"],
  [/network|connection\s*(reset|refused)|dns/i, "network_error"],
  [/issuer|bank\s*(down|offline|unavailable)/i, "temporary_bank"],
  [/do\s*not\s*honor|generic|declined?/i, "soft_decline"],
];

export function classifyFailure(input: ClassifyInput): FailureClassification {
  const codes = [
    NORMALISE(input.decline_code),
    NORMALISE(input.failure_code),
    NORMALISE(input.network_status),
  ].filter(Boolean);

  for (const c of codes) {
    if (c in CODE_MAP) return CODE_MAP[c];
  }

  const msg = input.failure_message ?? "";
  for (const [re, cls] of MESSAGE_HEURISTICS) {
    if (re.test(msg)) return cls;
  }
  return "unknown";
}

/**
 * Whether an event is worth retrying with the same payment method or should
 * short-circuit to a payment-method-update ask. Used by the decision engine
 * to skip pointless retries.
 */
export function isRetryable(cls: FailureClassification): boolean {
  switch (cls) {
    case "expired_card":
    case "fraud_suspected":
    case "incorrect_cvc":
    case "hard_decline":
      return false;
    default:
      return true;
  }
}
