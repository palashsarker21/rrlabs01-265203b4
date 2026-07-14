---
title: "3D Secure 2.2 Without Killing Conversion"
slug: "3d-secure-2-without-killing-conversion"
description: "How to route challenges, use exemptions, and design fallbacks so 3DS 2.2 reduces fraud without dropping checkout conversion."
keywords:
  ["3d secure 2", "3ds2 conversion", "psd2 sca", "3ds exemptions", "frictionless authentication"]
category: "Payments"
tags: ["3DS", "SCA", "PSD2", "Conversion"]
author: "RRLabs Editorial"
publishDate: "2026-06-25"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of a 3DS2 authentication flow with frictionless and challenge paths"
seoTitle: "3D Secure 2.2 Without Killing Conversion (2026 Guide)"
seoDescription: "Route challenges, apply exemptions, and design fallbacks so 3DS 2.2 reduces fraud without dropping checkout conversion."
ogTitle: "3D Secure 2.2 Without Killing Conversion"
ogDescription: "How to run SCA without losing the customer."
twitterTitle: "3DS2 Without Killing Conversion"
twitterDescription: "Route challenges, apply exemptions, design fallbacks."
---

3D Secure 2.2 is a good idea implemented in ways that routinely destroy 5–15% of checkout conversion. It does not have to. The difference between "3DS raises our approval rate" and "3DS killed our launch" is entirely about **when** you challenge, not whether you use it.

## The two paths through 3DS2

Every 3DS2 authentication resolves to one of two paths:

- **Frictionless** — the issuer authenticates the customer using signals already available (device, behavior, spend history) and returns an authenticated result with no user action. Invisible to the customer.
- **Challenge** — the issuer requires an interactive step (biometric, OTP, banking app confirmation).

The frictionless path is where you want to be for 95% of transactions. The challenge path is where 3DS conversion goes to die — 20–40% of challenges are abandoned mid-flow, depending on issuer and geography.

## Data quality is the biggest lever

Frictionless outcomes are driven by the data you send in the authentication request. The issuer decides whether to challenge based on the signals you provide. Send more signals; get frictionless more often.

Fields that materially move the frictionless rate:

- `billingAddressLine1`, `billingCity`, `billingCountry` — always send if you have them.
- `emailAddressHash` and `phoneNumberHash` — modern ACS servers use these.
- `accountAgeIndicator` — how long the user has had an account with you.
- `previousTransactionCount` — good customers with a history get frictionless more often.
- `shippingAddressMatchesBilling` — a strong signal.
- `deviceInfo` — user agent, screen size, color depth, timezone. The 3DS SDK collects most of this automatically.

Sending only the required minimum (PAN, amount, currency) is the largest single reason a business's frictionless rate is stuck at 40% while its peers are at 80%.

## Exemptions under PSD2

For transactions in scope of PSD2 (essentially: at least one leg in the EEA or UK), the acquirer can request exemptions from Strong Customer Authentication (SCA):

- **Low-value** — under €30, up to 5 in a row per card before an SCA is mandatory.
- **Transaction Risk Analysis (TRA)** — the acquirer's fraud rate qualifies the merchant for exemption; the acquirer requests it per transaction.
- **Merchant-initiated transactions (MIT)** — subscription renewals after the initial mandate are out of scope for SCA entirely. The initial mandate charge must be SCA-authenticated.
- **Trusted beneficiary** — the customer whitelisted your merchant with their bank.

Request exemptions **before** falling back to a challenge. Use `exemptionRequest` in the 3DS2 message. If the issuer denies the exemption, the flow escalates to challenge automatically — you lose nothing by asking.

## When to force a challenge

For a small class of transactions, you _want_ the challenge — it reduces fraud enough to justify the drop-off:

- First charge on a new account with high-risk signals (mismatched geo, VoIP number, disposable email).
- Card added by a user with a recent chargeback.
- Order value above your risk threshold.
- Card BIN from a country outside your normal customer base.

Everything else should default to frictionless, with exemptions requested where PSD2 applies.

## Subscription renewals: MIT, not SCA

The most expensive 3DS mistake in subscription is sending renewal charges through interactive 3DS. Renewals are **merchant-initiated transactions** — the customer authenticated the original mandate; the renewal is not a fresh checkout.

Configure your PSP to send subscription renewals with the correct MIT flag (`recurringPayment` transaction type, initial COF authentication reference). Card networks require this metadata; issuers use it to skip SCA. Without it, renewals fall into the SCA path and decline rates jump 15–30%.

## Fallback design when challenge fails

Users abandon challenges. Some challenges timeout. Some issuers' ACS servers go down. Your checkout must handle it:

1. Detect abandonment or timeout (5–7 minutes is a reasonable threshold).
2. Show a specific error: _"Your bank couldn't verify the payment. Try again or use a different card."_
3. Retry with the same card once, requesting a fresh authentication.
4. If that fails, prompt for a different payment method.

Do not silently retry challenges — that trains issuers to distrust your merchant descriptor. Do not show a generic error — that trains customers to blame you for what is really an issuer problem.

## Measurement

Track:

- **Authentication rate** — % of transactions that get an authenticated result (frictionless or challenge success).
- **Frictionless rate** — % of authenticated transactions that were frictionless.
- **Challenge abandonment rate** — % of challenges that timeout or are cancelled.
- **Post-3DS approval rate** — of authenticated transactions, % that then get approved by the issuer.

Optimize the frictionless rate first. That number moving from 60% to 85% is worth more than every other 3DS optimization combined.

## The RRLabs default

The Revenue Recovery Labs engine ships with a 3DS2 configuration profile: full data enrichment on every request, PSD2 exemptions applied where eligible, MIT flags on all renewals, and challenge fallback UI patterns tuned against real abandonment data. 3DS should be a fraud tool, not a conversion tax. Configured well, it is.
