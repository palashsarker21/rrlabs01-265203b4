---
title: "Card Testing Attacks: Detecting and Stopping BIN Enumeration"
slug: "card-testing-attacks-detection"
description: "How fraudsters test stolen card numbers against subscription signup forms and the exact controls that stop them without hurting real conversion."
keywords: ["card testing", "bin attack", "card enumeration", "fraud prevention", "signup fraud"]
category: "Fraud"
tags: ["Fraud", "Security", "Payments", "Risk"]
author: "RRLabs Editorial"
publishDate: "2026-06-23"
lastModified: "2026-07-14"
featured: false
imageAlt: "Chart showing a card testing attack spike against a checkout endpoint"
seoTitle: "Card Testing Attacks (2026) — Detection and Prevention Playbook"
seoDescription: "Detect BIN enumeration and card testing attacks on your signup flow — the controls that stop them without punishing real users."
ogTitle: "Card Testing Attacks: Detection and Prevention"
ogDescription: "Stop BIN enumeration without hurting conversion."
twitterTitle: "Card Testing Attacks"
twitterDescription: "Detection, prevention, response."
---

A card testing attack looks like nothing until it looks like a merchant-account review. A script iterates through stolen card numbers, running $1 authorizations against your signup form to find the ones that still work. You do not lose money on the tests — you lose money on the **decline ratio**, the **network fees**, and the eventual acquirer conversation about why 8% of your recent authorizations came from a single ASN in Moldova.

## What a card testing attack actually looks like

The signature is unmistakable once you have seen it:

- Signup volume spikes 5–50x within minutes.
- Authorization decline rate climbs from ~10% to 60–90%.
- The IPs come from a small pool — residential proxies, a single ASN, or a datacenter range.
- The user agents are homogenous or obviously scripted.
- No engagement follows successful signups — no page views, no product interaction, nothing.

If you have all five, you are being tested. If you have three, you are probably being tested.

## The controls that stop it

Layered defense, cheapest to most expensive:

1. **Rate limit by IP** — no more than 3 payment attempts per IP per 10 minutes.
2. **Rate limit by BIN** — no more than 10 attempts against the same 6-digit BIN per hour, across all IPs.
3. **Device fingerprinting** — FingerprintJS, ThumbmarkJS, or your PSP's built-in fingerprint. Same fingerprint + 3 declines = block.
4. **CAPTCHA after the first decline**, not before every payment. Real users get a clean path; scripts get walled.
5. **Velocity checks per fingerprint** — new signups from the same device within 60 seconds are suspect.
6. **Radar / Sift / Kount rules** at the PSP layer. Every major fraud engine has card-testing detection built in; turn it on.

Never rely on any single one. Sophisticated attackers rotate IPs, spoof user agents, and solve CAPTCHAs at scale. The stack of five is what stops them, because bypassing all five is expensive enough that they move to a softer target.

## What real users experience

Well-tuned controls are invisible to real users:

- First payment attempt: no CAPTCHA, no friction.
- Failed payment: CAPTCHA on the retry only.
- Suspicious signal (fingerprint match, high-risk BIN, velocity): 3DS challenge triggered by the PSP.

Aggressive controls that CAPTCHA every checkout drop real conversion 8–20%. Do not do that. Save friction for the second attempt.

## Response playbook when you're under attack

When the dashboard shows the signature:

1. **Enable emergency rate limits** — drop per-IP to 1 attempt per hour, drop per-BIN to 3 per hour.
2. **Force CAPTCHA on every payment** for 30–60 minutes.
3. **Block the offending ASN or IP range** at the CDN, not the app.
4. **Notify your acquirer** _before_ they notice — a proactive message from you looks different from a decline-ratio spike they surface first.
5. **Refund any successful $0.50–$5 test charges** that made it through, before those turn into chargebacks. Every one you miss becomes a Fraud dispute (code 10.4) and hurts your ratio.

Do not shut the checkout off entirely unless the attack is bad enough that legitimate signups would be indistinguishable from the noise. That costs revenue and signals weakness. Rate limits and CAPTCHAs are almost always sufficient.

## Chargeback ratio impact

Every successful test charge that becomes a Fraud chargeback counts against your ratio at the highest weight. A card testing attack can push your ratio from a comfortable 0.4% into the 1%+ zone within a single billing month, triggering a monitoring program. The recovery from that is 3–6 months of clean operations under network scrutiny.

The right defensive posture is not just to block the tests — it is to **refund the successful ones immediately**, before the real cardholder disputes them. Radar for Fraud Teams and equivalents can automate this; if you do not have that, a nightly job that refunds any charge under $5 with no product engagement is a crude but effective substitute.

## Detection heuristics you can run yourself

Even without a fraud engine, three queries catch most card testing:

```sql
-- 1. Decline rate by IP, last hour
SELECT ip, COUNT(*) attempts, SUM(status='failed')::float / COUNT(*) decline_rate
FROM payment_attempts
WHERE occurred_at > NOW() - INTERVAL '1 hour'
GROUP BY ip HAVING COUNT(*) > 10 AND decline_rate > 0.6;

-- 2. Attempts per BIN, last hour
SELECT LEFT(card_bin, 6) bin, COUNT(*) attempts
FROM payment_attempts
WHERE occurred_at > NOW() - INTERVAL '1 hour'
GROUP BY bin HAVING COUNT(*) > 20;

-- 3. New signups with no engagement, last 24h
SELECT customer_id FROM customers c
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (SELECT 1 FROM events e WHERE e.customer_id = c.id);
```

Run them every 15 minutes, alert when the counts exceed baseline by 3x.

## The RRLabs default

The Revenue Recovery Labs engine ingests every payment attempt event from your PSP and runs the detection heuristics automatically, escalating to CAPTCHA and rate limiting at pre-configured thresholds. When an attack is detected, we auto-refund suspect charges before they age into disputes. Card testing is not a payments problem you solve once — it is a background threat you manage continuously.
