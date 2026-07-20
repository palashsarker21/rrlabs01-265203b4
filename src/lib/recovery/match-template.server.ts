/**
 * Template matcher — server-side helper that scores existing recovery_templates
 * against an event's match keys (classification, language, country, gateway,
 * product_kind, segment, step, channel) and returns the best row + confidence.
 *
 * When confidence < workspace.template_reuse_threshold, callers should
 * generate a new template via AI and INSERT it back with source='ai_generated'
 * plus the match keys so the next similar event can reuse it (learning loop).
 */

import type { FailureClassification } from "./classify.server";

export interface TemplateRow {
  id: string;
  workspace_id: string;
  step: number;
  channel: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  failure_classification: FailureClassification | null;
  country: string | null;
  language: string | null;
  gateway: string | null;
  product_kind: string | null;
  customer_segment: string | null;
  tone: string | null;
  source: string;
  usage_count: number;
  success_count: number;
  confidence: number;
  enabled: boolean;
}

export interface MatchKeys {
  step: number;
  channel: string;
  classification: FailureClassification;
  language: string;
  country?: string | null;
  gateway?: string | null;
  product_kind?: string | null;
  customer_segment?: string | null;
}

export interface MatchResult {
  template: TemplateRow | null;
  confidence: number;
  matched: boolean;
  match_keys: MatchKeys;
}

const WEIGHTS = {
  classification: 0.35,
  language: 0.25,
  channel: 0.15, // hard-required, only rows with same channel enter
  step: 0.1, // hard-required
  country: 0.05,
  gateway: 0.05,
  product_kind: 0.03,
  customer_segment: 0.02,
} as const;

function scoreTemplate(t: TemplateRow, k: MatchKeys): number {
  if (t.channel !== k.channel || t.step !== k.step || !t.enabled) return 0;

  let score = WEIGHTS.channel + WEIGHTS.step;
  if (t.failure_classification && t.failure_classification === k.classification) {
    score += WEIGHTS.classification;
  } else if (!t.failure_classification) {
    score += WEIGHTS.classification * 0.5; // generic fallback template
  }
  if (t.language && k.language && t.language.toLowerCase().slice(0, 2) === k.language.toLowerCase().slice(0, 2)) {
    score += WEIGHTS.language;
  } else if (!t.language) {
    score += WEIGHTS.language * 0.4;
  }
  if (t.country && k.country && t.country.toUpperCase() === k.country.toUpperCase()) {
    score += WEIGHTS.country;
  }
  if (t.gateway && k.gateway && t.gateway === k.gateway) score += WEIGHTS.gateway;
  if (t.product_kind && k.product_kind && t.product_kind === k.product_kind) {
    score += WEIGHTS.product_kind;
  }
  if (
    t.customer_segment &&
    k.customer_segment &&
    t.customer_segment === k.customer_segment
  ) {
    score += WEIGHTS.customer_segment;
  }

  // Learning boost: templates with good historical success rate get a small lift.
  if (t.usage_count > 0) {
    const successRate = t.success_count / t.usage_count;
    score += Math.min(0.05, successRate * 0.05);
  }
  return Math.min(1, score);
}

export function matchTemplate(
  templates: TemplateRow[],
  keys: MatchKeys,
  threshold: number,
): MatchResult {
  let best: TemplateRow | null = null;
  let bestScore = 0;
  for (const t of templates) {
    const s = scoreTemplate(t, keys);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return {
    template: best,
    confidence: bestScore,
    matched: best !== null && bestScore >= threshold,
    match_keys: keys,
  };
}
