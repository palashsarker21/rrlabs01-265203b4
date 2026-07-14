---
title: "3DS and SCA Failures Are Different — Here's How to Recover Them"
slug: "3ds-sca-recovery"
description: "Authentication-required failures are the most recoverable class of payment failure, and the most mishandled. A guide to 3DS/SCA recovery flows that actually convert."
keywords:
  [
    "3ds recovery",
    "sca payment failures",
    "authentication required",
    "strong customer authentication",
    "3d secure recovery",
  ]
category: "Engineering"
tags: ["3DS", "SCA", "Payments", "Recovery", "Compliance"]
author: "RRLabs Engineering"
publishDate: "2026-06-25"
lastModified: "2026-07-14"
featured: false
imageAlt: "3DS Strong Customer Authentication recovery flow"
seoTitle: "3DS & SCA Recovery — Authentication-Required Failures Done Right"
seoDescription: "Recover authentication-required payment failures with one-tap flows and smart timing. Full guide."
ogTitle: "3DS and SCA Recovery"
ogDescription: "Authentication-required failures are the most recoverable — if you do it right."
twitterTitle: "3DS and SCA Recovery"
twitterDescription: "The most recoverable failure class — and how to actually recover it."
---

When Europe implemented PSD2 SCA in 2019, involuntary churn rates in EU subscription businesses jumped 3–5 percentage points overnight. The gap has narrowed since, but authentication-required failures remain the **single largest recoverable category** in most subscription portfolios.

Here's how to handle them correctly.

## What's actually happening

When a card requires Strong Customer Authentication and the customer isn't present to complete it, the payment fails with `authentication_required` (Stripe), `AuthorisationRequired` (Adyen), or similar. This is not a real decline. The card works. The bank is asking "is this really them?"

Traditional dunning treats this identically to `insufficient_funds`, which is wrong. The customer has money and intent. They just need to tap "yes, that's me" on a bank challenge screen.

## The one-tap confirmation flow

The correct recovery for 3DS failures is a **direct link to the authentication challenge**, delivered on a channel the customer will see quickly, worded to lower cognitive load.

Stripe exposes this via `payment_intent.next_action.redirect_to_url`. Similar hooks exist on Adyen, Braintree, and Mollie. Do not surface it inside a generic "update payment method" page. Surface it as its own flow:

```ts
// After a payment_intent.requires_action webhook:
const confirmationUrl = await createRecoveryLink({
  paymentIntentId: event.data.object.id,
  customerId: event.data.object.customer,
  expiresIn: 48 * 3600,
});

await notifyCustomer({
  customerId: event.data.object.customer,
  templateId: "sca_confirmation_needed",
  variables: { url: confirmationUrl, amount: event.data.object.amount },
});
```

The recovery link should:

- Be single-use, expiring in 24–72 hours.
- Land directly on the bank challenge, not on a login page.
- Fall back to the standard update-payment page if the challenge session expires.

## Timing beats copy here

3DS challenges are contextual. If the customer got a push notification from their bank an hour ago about a declined charge, they're primed to expect an email from you asking them to confirm. Send fast.

- **T+15 minutes** for the first send.
- **T+4 hours** if unopened.
- **T+24 hours** as the final.

Beyond 48 hours, the challenge session usually expires anyway. Route back to a full payment update at that point.

## Channel selection matters more

For 3DS specifically, WhatsApp and SMS convert dramatically better than email — often 2–3x — because:

- The customer is already thinking about payments (they just got a bank notification).
- The channel is on-device, one tap away.
- The message is short enough for a mobile glance.

If you have WhatsApp Business set up, this is where you use it. Category: Authentication template. Approved by Meta specifically for this pattern.

## Copy that works

**Email:**

> Your bank just needs a quick confirmation on your $49 monthly Acme charge. Tap once and you're done — takes about 5 seconds.
>
> [Confirm with my bank]

**WhatsApp (Authentication template):**

> Hi {{1}}, your bank needs one tap to confirm your {{2}} payment: {{3}}

**SMS:**

> Acme: your bank flagged a $49 charge for confirmation. Tap to verify (5s): {{link}}

Under 25 words. Never mention "declined" or "failed" — the customer is likely to think fraud happened and worry more, not act faster.

## What good looks like

For 3DS-specific recovery:

- **60–75% recovery within 48 hours** with a proper one-tap flow.
- **40% recovery even with a mediocre generic dunning email** — this is the easiest category to recover, and even bad implementations do okay.

The lift from a proper 3DS-specific flow over generic dunning is typically 20+ percentage points. On EU-heavy portfolios, this alone is often the difference between a good recovery rate and a great one.

## Compliance notes

- 3DS/SCA challenge links are **not** exempt from PSD2. Do not attempt to bypass or auto-confirm.
- Merchant-initiated transactions (MIT) can be exempt if properly tagged upstream. If you're not tagging MITs on subscriptions, you're generating unnecessary SCA challenges — separate problem, worth fixing.
- Storing anything from the challenge itself (device fingerprint, bank response) beyond what your PSP surfaces is generally out of scope for a merchant.

---

_See also: [Stripe Failed Payments: The Complete Guide](/blog/stripe-failed-payments-guide) for the full decline-code reference._
