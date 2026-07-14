---
title: "Subscription Tax Compliance Without Losing Your Mind: VAT, Sales Tax, GST"
slug: "subscription-tax-compliance"
description: "A practical map of VAT, US sales tax, GST, and digital services taxes for SaaS subscriptions — where to register, what to collect, and what to automate."
keywords:
  [
    "saas sales tax",
    "vat digital services",
    "gst subscription",
    "moss oss",
    "subscription tax compliance",
  ]
category: "Operations"
tags: ["Tax", "VAT", "Compliance", "SaaS", "Operations"]
author: "RRLabs Editorial"
publishDate: "2026-07-03"
lastModified: "2026-07-14"
featured: false
imageAlt: "Global subscription tax jurisdictions"
seoTitle: "SaaS Subscription Tax Compliance — VAT, Sales Tax, GST"
seoDescription: "Practical tax guide for global SaaS subscriptions: registration thresholds, collection, and automation."
ogTitle: "Subscription Tax Compliance"
ogDescription: "VAT, sales tax, GST — the practical map."
twitterTitle: "Subscription Tax Compliance"
twitterDescription: "VAT, sales tax, GST — the practical map."
---

Tax is the least-glamorous part of subscription billing and the most expensive to get wrong. Fines and back-taxes eat years of margin. Here's the map most teams need.

## Where you almost certainly owe

- **EU (VAT / OSS):** any digital service sold to EU consumers, from euro one. Register for OSS in one EU country, file quarterly.
- **UK VAT:** £0 threshold for non-UK sellers of digital services to UK consumers.
- **US sales tax:** economic nexus in ~45 states. Thresholds vary ($100K sales OR 200 transactions is common). SaaS is taxable in ~20 states.
- **Canada GST/HST/QST:** register at CA$30K in taxable supplies.
- **Australia GST:** register at AU$75K.
- **India GST:** OIDAR rules require registration for digital services to Indian consumers.

## B2B vs B2C — the reverse charge rule

For EU B2B sales, if the customer provides a valid VAT ID, reverse charge applies: you don't collect VAT; they self-account. This requires **VIES validation** on every invoice. Failing to validate = the tax authority treats it as B2C = you owe the VAT.

Automate VIES lookup at signup and at every invoice generation. Cache for 24 hours max.

## Prices inclusive vs exclusive

- **EU consumer:** prices must be displayed VAT-inclusive by law. Show `€24 incl. VAT`.
- **US:** prices displayed exclusive of sales tax is standard.
- **Mixed audience:** detect location before showing pricing. Otherwise you're either under-charging or scaring off buyers.

## What to automate

Do not build tax calculation in-house. Every credible option:

- **Stripe Tax** — cheapest, decent coverage, weak on complex US local taxes
- **Anrok** — SaaS-native, US-focused, strong compliance workflow
- **Avalara / Vertex** — enterprise, expensive, comprehensive

Rule of thumb: under $5M ARR use Stripe Tax. $5M–$50M use Anrok. Above that, evaluate Avalara.

## The failed-payment tax question

If a charge fails and is later recovered, the taxable event is the **original invoice date**, not the recovery date, for accrual-basis reporting. Cash-basis reporting uses the recovery date. Pick one and be consistent.

For refunds/chargebacks, most jurisdictions allow reversal in the period the refund occurs, not the original sale period. Track them separately.

## The audit checklist

- Tax invoices retained for 7 years (10 in some EU jurisdictions)
- VAT ID validations logged with timestamp
- Exemption certificates on file for US B2B sales
- Cross-border digital services flagged in ledger
- Reverse charges labeled explicitly on invoices

Get an accountant who specifically handles SaaS/digital services before your first international renewal cycle. It costs less than one mistake.
