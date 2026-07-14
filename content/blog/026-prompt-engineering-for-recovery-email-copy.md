---
title: "Prompt Engineering for Recovery Email Copy"
slug: "prompt-engineering-for-recovery-email-copy"
description: "The exact prompts, guardrails, and evaluation harness we use to generate high-converting payment recovery emails with LLMs."
keywords: ["prompt engineering", "recovery email copy", "llm email generation", "ai marketing copy", "generative email"]
category: "AI"
tags: ["AI", "Prompts", "Email", "Copy"]
author: "RRLabs Editorial"
publishDate: "2026-07-03"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of a prompt with structured inputs and constraints for recovery email generation"
seoTitle: "Prompt Engineering for Recovery Email Copy (2026)"
seoDescription: "Exact prompts, guardrails, and evaluation harness for generating high-converting payment recovery emails with LLMs."
ogTitle: "Prompt Engineering for Recovery Email Copy"
ogDescription: "How RRLabs writes recovery emails with AI."
twitterTitle: "AI-Written Recovery Emails"
twitterDescription: "Prompts, guardrails, evaluation."
---

Generic AI-written recovery emails perform worse than the templated ones they replace. The difference between "LLMs are useless for this" and "LLMs 3x'd our recovery" is the **prompt architecture, the guardrails, and the evaluation harness**. All three, not any one.

## Structured inputs beat free-form prompts

Do not prompt with "write a recovery email." Prompt with a structured object. A minimal schema:

```json
{
  "customer": { "first_name": "Anna", "signup_locale": "es-MX" },
  "product": { "name": "Netflix Standard", "brand_voice": "casual_confident" },
  "subscription": { "plan": "Standard", "price": "$15.49", "renewal_day": 12 },
  "failure": {
    "code": "insufficient_funds",
    "category": "soft_timing",
    "attempt_number": 1,
    "next_retry_at": "2026-07-17"
  },
  "cadence_step": { "channel": "email", "step": 1, "days_since_failure": 2 },
  "cta_url": "https://short.link/xyz",
  "constraints": {
    "max_subject_chars": 60,
    "max_body_words": 90,
    "tone": "friendly, non-shaming",
    "must_include": ["one CTA", "when the retry happens"],
    "must_avoid": ["urgency language", "the word delinquent"]
  }
}
```

Structured inputs let the model choose the right register — a `es-MX` locale + `casual_confident` brand voice + `soft_timing` failure produces a different email than `en-US` + `formal` + `hard`. The variance is what makes AI-written copy actually good.

## System prompt: role, rules, format

The system prompt should encode role, immutable rules, and output format. Not the input.

```
You are a bilingual copywriter for a subscription product. You write short,
friendly payment-recovery emails. You never shame the reader. You never use
urgency language ("act now", "final notice"). You never invent facts —
if a field is missing, omit that sentence.

Rules:
- Match the customer's signup_locale.
- Use the exact CTA URL provided; do not modify it.
- Keep subject under the max_subject_chars limit.
- Keep body under the max_body_words limit.
- Output valid JSON: { "subject": string, "preheader": string, "body_markdown": string }.
```

Two things this prompt does that most don't: it forbids invention ("if a field is missing, omit that sentence"), and it constrains output to a machine-parseable format. Both are essential.

## Guardrails that ship

Never send AI-generated copy directly to a customer. Between generation and send, run:

1. **Length check** — subject/body within limits.
2. **Banned-phrase check** — regex over "delinquent," "act now," "final notice," and 30 other landmine phrases you have discovered the hard way.
3. **Fact check** — the CTA URL matches exactly; the price matches exactly; the retry date matches exactly.
4. **Language check** — the output language matches the customer's signup locale.
5. **Tone classifier** — a small model or ruleset that flags shaming, urgency, or condescension.

Any failure sends the message back through generation once. Second failure falls back to a hand-written template. Do not send anything that failed twice.

## Evaluation harness

Prompt changes look like improvements 60% of the time and are actually regressions 30% of the time. Ship an evaluation harness:

- A frozen set of 200–500 real anonymized (customer, failure, cadence) tuples.
- Human-graded gold references for tone, clarity, and CTA presence.
- An LLM-as-judge scorer for tone match, factual accuracy, and constraint adherence.
- A/B production tests as the final arbiter.

New prompts must beat the current champion on the harness *and* in production. Regression in either kills the change. The engineering discipline is the difference between "we ship AI copy" and "we ship better copy than we did before AI."

## Locale is not translation

Do not generate an English email and translate. Generate directly in the target locale. Reasons:

- Idiom and register do not translate. "Hey" in English is "Hola" in Spanish but *not* "Bonjour" in French — the French equivalent of "Hey" is closer to "Salut."
- Cultural payment conventions differ. In Germany, receipts should reference the SEPA mandate ID. In Brazil, they should reference the Pix key or invoice number.
- Legal disclosures differ per market and cannot be translated on the fly.

The system prompt above accepts a locale field. Use it.

## Attribution windows and A/B

When testing AI copy against templates, hold the attribution window and channel constant. If you A/B new AI copy against a template that has been in market for a year, the template has an unfair advantage (it has already burned deliverability accumulated over time; the new one has not). Rotate both variants for at least 4 weeks before reading results.

## Fine-tuning: usually not

Fine-tuning a base model on your recovery emails is usually the wrong move. Reasons:

- The task is small (a few hundred lines of copy per language). Fine-tuning wastes signal.
- Base models updated by the vendor beat last-quarter's fine-tune in almost every generation.
- Guardrails and evaluation give you 90% of the benefit at 1% of the operational cost.

Fine-tune only if:

- Your brand voice is genuinely uncopyable by prompting (rare).
- You have >10k in-brand examples to train on.
- You have a lifecycle team that will maintain the tune across base-model upgrades.

## Cost budget

Each recovery email generation is 200–500 output tokens plus a small prompt. At current gateway rates that is fractions of a cent per email. Do not over-optimize model choice for cost — the recovery revenue per email dwarfs the generation cost by 4–6 orders of magnitude. Choose the model that produces the best copy under your guardrails; ignore the price.

## The RRLabs default

The Revenue Recovery Labs copy engine ships with structured input schemas per language, a system prompt hardened against 30+ landmine phrases, a guardrail pipeline with automatic fallback to templates, and a frozen evaluation harness that every prompt change must pass. AI-written copy converts 40–70% better than the templates it replaces — but only because none of the copy that reaches the customer is unreviewed AI output. It is AI output that survived the guardrails.
