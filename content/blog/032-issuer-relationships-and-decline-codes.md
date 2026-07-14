---
title: "Issuer Relationships and Decline Codes: The Bank Signals You Should Actually Read"
slug: "issuer-relationships-and-decline-codes"
description: "Decline codes carry more information than most billing teams use. How to read them, group them, and route retries based on issuer behavior."
keywords: ["decline codes", "issuer decline", "stripe decline codes", "payment retry logic", "issuer relationships"]
category: "Engineering"
tags: ["Payments", "Cards", "Decline Codes", "Engineering", "Retries"]
author: "RRLabs Engineering"
publishDate: "2026-07-02"
lastModified: "2026-07-14"
featured: false
imageAlt: "Decline code routing decision tree"
seoTitle: "Decline Codes & Issuer Relationships — A Practical Guide"
seoDescription: "How to read decline codes and route retries based on issuer behavior."
ogTitle: "Issuer Relationships and Decline Codes"
ogDescription: "The bank signals your billing team should actually read."
twitterTitle: "Decline Codes That Matter"
twitterDescription: "The bank signals your billing team should read."
---

Every declined charge carries two codes: a **network code** (Visa/MC) and an **issuer response code**. Most billing systems collapse them into "failed" and move on. The teams that recover 20+ points more than average don't.

## The five buckets that matter

Group codes into these buckets. Retry logic changes per bucket, not per code.

**Soft — funds/timing:** `insufficient_funds`, `try_again_later`, `processing_error`. Retry with backoff. Recovery rate: 50–70%.

**Hard — instrument dead:** `card_declined`, `stolen_card`, `lost_card`, `pickup_card`. Do not retry. Recovery only via customer action.

**Auth — needs cardholder:** `authentication_required`, `3ds_required`. Do not retry silently. Send 3DS challenge immediately.

**Risk — issuer suspicious:** `fraudulent`, `do_not_honor`, `security_violation`. Wait 48–96h before retry. Consider stepping up 3DS on next attempt.

**Config — merchant issue:** `expired_card`, `incorrect_cvc`, `incorrect_zip`. Customer must update. Some are recoverable via network tokens/account updater.

## The costliest mistake: retrying `do_not_honor` immediately

`do_not_honor` (code 05) is the most common decline in the wild. It's an issuer catch-all that means "we don't want to say why." Retrying within an hour makes it worse — the issuer's risk model treats repeated attempts as fraud signals and escalates to hard declines.

Right pattern: wait 48–96 hours, retry once at a different time-of-day, and if that fails, route to dunning outreach.

## Issuer-specific patterns worth learning

- **Chase (US):** aggressive on evening/weekend risk holds. Retry Monday mornings.
- **Barclaycard (UK):** rejects on FX descriptor mismatch. Ensure MCC and descriptor match customer country.
- **Bradesco/Itaú (BR):** frequent `try_again_later` from network congestion. Retry with 4–8h delay.
- **HDFC/ICICI (IN):** strict SI (standing instruction) rules. Every recurring charge needs explicit mandate.

## Descriptor discipline

Cardholders dispute what they don't recognize. Your descriptor should:

- Match your brand name exactly (`ACME* SUBSCRIPTION` not `AC INC 8827`)
- Include a working phone/URL suffix
- Stay consistent across renewals

A single descriptor change triggers a chargeback spike for 30–45 days. Plan them like migrations.

## What to instrument

Log both `decline_code` and `issuer_response_code` on every failure. Chart failure rates by BIN (first 6 digits of card). BINs that fail 3x your baseline are candidates for special handling — different retry timing, different 3DS thresholds, or an issuer conversation via your PSP.
