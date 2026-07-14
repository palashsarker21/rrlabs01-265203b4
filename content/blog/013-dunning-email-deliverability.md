---
title: "Deliverability for Dunning Emails: Getting Recovery Mail Into the Inbox"
slug: "dunning-email-deliverability"
description: "SPF, DKIM, DMARC, warm-up, list hygiene, and content rules that keep payment recovery emails out of spam and in the primary tab."
keywords: ["email deliverability", "dunning email", "spf dkim dmarc", "transactional email", "payment recovery email"]
category: "Deliverability"
tags: ["Email", "Deliverability", "Dunning", "DMARC"]
author: "RRLabs Editorial"
publishDate: "2026-06-07"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of an email traveling through SPF, DKIM, and DMARC checks"
seoTitle: "Dunning Email Deliverability (2026) — SPF, DKIM, DMARC, and Content Rules"
seoDescription: "The exact deliverability setup RRLabs uses to keep payment recovery emails in the primary inbox — auth, warm-up, hygiene, and content."
ogTitle: "Deliverability for Dunning Emails"
ogDescription: "How to keep failed-payment emails out of spam."
twitterTitle: "Dunning Email Deliverability"
twitterDescription: "Auth, warm-up, hygiene, and content rules for recovery mail."
---

A perfectly designed recovery message that lands in the spam folder recovers zero dollars. Deliverability is the invisible layer that decides whether every other decision you have made about dunning matters at all. This is the setup we use.

## Send recovery mail from a dedicated subdomain

Do not send dunning email from your marketing domain (`marketing.company.com`) or your primary domain (`company.com`). Use a dedicated subdomain such as `billing.company.com` or `receipts.company.com`.

Reasons:

1. Reputation is per-domain. A marketing blast that gets flagged as spam should not degrade your payment recovery deliverability.
2. Mailbox providers weight transactional patterns (1:1 sends, high open rates, low complaint rates) differently than bulk patterns. Isolate them.
3. It makes DMARC alignment tractable — you can run `p=reject` on the billing subdomain long before you are ready to on the root.

## SPF, DKIM, DMARC — non-negotiable

Every recovery email must pass all three:

- **SPF**: authorize your ESP's sending IPs for the billing subdomain.
- **DKIM**: sign every message with a 2048-bit key rotated at least yearly.
- **DMARC**: publish `v=DMARC1; p=reject; rua=mailto:dmarc-reports@company.com; adkim=s; aspf=s`.

Strict alignment (`adkim=s; aspf=s`) is important. Relaxed alignment silently allows spoofing under subdomains and is one of the most common reasons a technically "authenticated" domain still lands in spam at Gmail.

## BIMI, once DMARC is at p=reject

After DMARC has been enforcing at `p=reject` for 30+ days with clean reports, publish a BIMI record and a VMC-signed SVG logo. It adds a verified brand mark next to your sender name at Gmail, Yahoo, Apple Mail, and Fastmail. Deliverability impact is small; **click-through impact on recovery emails is meaningful** — roughly 8–12% lift in our A/B tests, because customers trust that the "your card failed" email is real.

## Warm up the subdomain

A brand-new sending subdomain has no reputation. Sending 50,000 dunning emails on day one from a cold subdomain is a guaranteed spam-folder placement at Gmail and Microsoft.

Ramp:

- Day 1–3: 500/day, to your most engaged users only.
- Day 4–7: 2,000/day.
- Week 2: 10,000/day.
- Week 3: 50,000/day.
- Week 4+: full volume.

The RRLabs engine handles this automatically when you connect a new sending domain — the first two weeks of recovery emails are throttled and routed by engagement score.

## List hygiene for transactional mail

Dunning email is transactional, but hygiene still matters. Rules:

- Never send to an address that has hard-bounced in the last 90 days.
- Never send to an address that has marked *any* of your mail as spam.
- Suppress addresses that have not opened *any* mail from you in 180 days, even transactional. Their engagement score is dragging your whole domain down.
- Validate new addresses at signup (syntax + MX + disposable check).

## Content rules that survive filters

Modern spam filters are ML models. The old "avoid the word FREE" rules are mostly noise. What actually matters in 2026:

- **Text-to-image ratio**: at least 60% text.
- **Link count**: 1–3 links per message. Recovery emails need one primary CTA, not eight.
- **Link domains**: all links go to the same domain as the sender, or to a domain with an equally clean reputation. Never link to `bit.ly` or a tracking-only domain in a payment email.
- **List-Unsubscribe header**: RFC 8058 one-click unsubscribe, even on transactional. Yahoo and Gmail require it for bulk senders in 2024+.
- **Plain-text alternative**: always include one. Filters penalize HTML-only messages.

## Measure the right things

Do not optimize for open rate alone — Apple Mail Privacy Protection inflates it. Track:

- **Delivered rate** (via SMTP response) — should be >99%.
- **Inbox placement rate** (via seed lists at Gmail / Outlook / Yahoo) — should be >95%.
- **Complaint rate** — must stay below 0.1%.
- **Click-through on primary CTA** — the number that actually moves recovered revenue.

If inbox placement drops at one provider, that is where to dig. If it drops everywhere at once, you have a domain reputation problem — usually caused by sending to a stale list or by a content change.

## The RRLabs default

The Revenue Recovery Labs engine ships with an opinionated deliverability layer: dedicated subdomain provisioning, automatic SPF/DKIM/DMARC setup with strict alignment, warm-up scheduling, engagement-based suppression, and seed-list monitoring at the four major providers. Every dunning email is DMARC-aligned before it leaves the queue. That is table stakes for recovering revenue at scale — the rest of your recovery system depends on it.
