---
title: "Handling Currency Exchange for Global Subscriptions"
slug: "handling-currency-exchange-for-global-subscriptions"
description: "How to price, charge, and reconcile subscriptions across currencies without leaking margin to FX spreads or accounting mismatches."
keywords: ["currency conversion", "fx subscription", "multi currency saas", "presentment currency", "billing fx"]
category: "Payments"
tags: ["FX", "Currency", "Payments", "International"]
author: "RRLabs Editorial"
publishDate: "2026-07-05"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of settlement vs presentment currency flows"
seoTitle: "Handling Currency Exchange for Global Subscriptions (2026)"
seoDescription: "Price, charge, and reconcile subscriptions across currencies without leaking margin to FX spreads or accounting mismatches."
ogTitle: "Currency Exchange for Global Subscriptions"
ogDescription: "How to price and settle across currencies."
twitterTitle: "FX for Subscriptions"
twitterDescription: "Presentment, settlement, and reconciliation."
---

Charging customers in their local currency raises conversion. Doing it wrong costs 2–5% of revenue to FX spreads, an equivalent amount in confused reconciliation, and support tickets that eat every gain. The right approach is a discipline, not a single decision.

## Presentment vs. settlement currency

Two currencies matter in every cross-border subscription:

- **Presentment currency** — what the customer sees on the invoice and their statement. Usually their local currency.
- **Settlement currency** — what your bank account receives. Usually your home currency.

The PSP converts between them. That conversion has a spread — typically 1–2% for major currency pairs, 2–4% for exotic pairs. Whichever party bears that spread is where the money goes.

## Three pricing models

Pick one and commit:

1. **Home-currency pricing** — the customer sees $29 USD, their card issuer converts to local currency at the network rate + issuer markup (usually 2–4%). Simplest for you; worst experience for the customer.
2. **Fixed local pricing** — €26 in EU, £24 in UK, ¥3,600 in Japan. You pick the local prices, updated quarterly or on FX shocks. You bear FX risk.
3. **Dynamic pricing** — presentment currency computed at charge time from a live FX rate plus a margin. The customer sees a price that varies with the rate.

Fixed local pricing is the default for most subscription businesses under $100M. It is predictable for the customer, tolerable for finance, and simple to reason about. Dynamic pricing is for marketplaces and usage-based products, not subscriptions.

## FX risk in fixed local pricing

If you price €26 in the EU and USD/EUR moves 8%, you have either given up 8% margin or gotten a windfall. Neither is good — the second one attracts a customer complaint next quarter when it reverses.

Manage FX risk by:

1. Reviewing local prices quarterly and adjusting on any FX move > 5% versus the previous review.
2. Grandfathering existing customers at their subscribed price (see the pricing experiments article — this rule doesn't change for currency reasons).
3. Optionally hedging with forward contracts if annual revenue in a single non-home currency exceeds ~$5M.

Most SaaS companies under $50M ARR don't hedge; they eat the FX volatility. That's fine — the operational cost of a hedging program outweighs the volatility until revenue-per-currency is large.

## Never mix currencies in a single subscription

A subscription created in EUR must charge EUR for its entire life. Do not switch mid-cycle. Do not switch even at renewal. Grandfather in place.

Switching currencies on an active subscription:

- Confuses the customer ("why is this now in dollars?").
- Breaks cohort analysis (the same customer appears in multiple currency cohorts).
- Frequently triggers 3DS on the first charge in the new currency, dropping conversion.
- Occasionally counts as a "new subscription" in tax jurisdictions, requiring re-consent.

The right pattern for customers moving between currency zones is: they cancel the old subscription and start a new one in the new currency, keeping their data. Not a mid-subscription switch.

## Reconciliation across currencies

Reporting revenue that spans currencies requires a consistent conversion policy:

- **Booked revenue**: convert at the FX rate on the charge date.
- **Cash received**: use the actual PSP settlement amount in home currency.
- **Deferred revenue**: convert at the rate on the recognition date, and account for FX gain/loss between charge and recognition.

Do not aggregate "total revenue" across currencies without stating the conversion rate and the date. A dashboard that shows "$1,240,000 revenue" without saying which rate is used will disagree with the general ledger within a month.

## Refunds cross the same spread again

A €26 charge that settled to your account as $28 USD, then refunded, will cost you the customer's €26 back out of your PSP balance — but the FX rate has moved. The refund settles at the new rate, and the difference lands somewhere: usually as an FX loss on your books.

Two implications:

1. Do not treat refunds as free. There is an FX cost proportional to the delay between charge and refund.
2. Chargebacks are worse — they include the chargeback fee, the ratio impact, *and* the FX exposure.

Neither is a reason not to refund; both are reasons to configure the underlying flows well so refunds are rare.

## Tax on FX

VAT/GST is calculated on the presentment currency, not the settlement currency. Your tax remittance to a foreign jurisdiction must be in the local currency, converted at the official rate specified by that jurisdiction (usually the central-bank rate on the invoice date).

This is a place where "close enough" is not close enough. Use a tax engine (Stripe Tax, Anrok, TaxJar, Fonoa) that knows each jurisdiction's rules. Do not implement it yourself.

## Multi-currency PSP setup

To charge in multiple presentment currencies while settling to your home currency, most PSPs require:

- A merchant account per settlement currency (some auto-provision; some require sales cycle).
- Local acquiring in the target region for best approval rates (a US card charged in EUR by a US acquirer approves 5–15% lower than the same card charged by an EU acquirer).
- Tax registration in jurisdictions above threshold.

Local acquiring is the biggest lever most global subscription businesses underuse. If a meaningful share of your revenue is in the EU or UK, get an EU/UK acquirer, not just multi-currency presentment through a US acquirer.

## The RRLabs default

The Revenue Recovery Labs engine treats currency as immutable per subscription, computes recovery economics in the customer's presentment currency, and reconciles settlements in your home currency with per-day FX rates from the PSP's own settlement report. Every dashboard line item states its currency and rate. There is exactly one "revenue" number for finance and one for product, and they agree — because they use the same conversion policy.
