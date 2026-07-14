---
title: "Stripe Failed Payments: The Complete Guide to Decline Codes, Retries, and Recovery"
slug: "stripe-failed-payments-guide"
description: "A definitive reference for Stripe payment failures — every major decline code, when to retry, when to stop, and how to build recovery flows that actually work."
keywords:
  [
    "stripe failed payments",
    "stripe decline codes",
    "stripe retry logic",
    "smart retries",
    "payment recovery",
  ]
category: "Engineering"
tags: ["Stripe", "Payments", "Dunning", "Engineering", "Webhooks"]
author: "RRLabs Engineering"
publishDate: "2026-06-05"
lastModified: "2026-07-14"
featured: true
imageAlt: "A decline code lifecycle diagram for Stripe failed payments"
seoTitle: "Stripe Failed Payments — Decline Codes, Retries & Recovery (2026)"
seoDescription: "The engineering-grade reference for handling Stripe payment failures, retries, and recovery flows in production."
ogTitle: "Stripe Failed Payments: The Complete Guide"
ogDescription: "Every decline code, every retry strategy, every webhook — one reference."
twitterTitle: "Stripe Failed Payments: The Complete Guide"
twitterDescription: "Decline codes, retries, and recovery flows that actually work."
---

If you run a subscription business on Stripe, **the difference between a good year and a great year often comes down to how you handle failed charges**. Stripe surfaces enough signal to make excellent recovery decisions. Most teams use maybe 20% of it.

This is the engineering reference we wish existed when we started RRLabs.

## The webhook events that matter

You don't need to listen to every Stripe event. For failed-payment recovery, these are the ones that carry real signal:

- `invoice.payment_failed` — subscription charge failed
- `invoice.payment_succeeded` — recovery happened (celebrate, then measure)
- `payment_intent.payment_failed` — one-off charge failed
- `payment_intent.requires_action` — 3DS or SCA challenge waiting
- `charge.failed` — the lowest-level signal, useful for reconciliation
- `customer.subscription.updated` — status changed to `past_due` or `unpaid`
- `customer.subscription.deleted` — Stripe gave up and canceled

Everything else is nice-to-have. These are load-bearing.

```ts
// A minimal Stripe webhook router for recovery
app.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);

  switch (event.type) {
    case "invoice.payment_failed":
      await enqueueRecovery(event.data.object);
      break;
    case "invoice.payment_succeeded":
      await markRecovered(event.data.object);
      break;
    case "payment_intent.requires_action":
      await notify3DSChallenge(event.data.object);
      break;
  }

  res.json({ received: true });
});
```

## Decline codes, translated

Stripe returns two useful strings on a failed charge: `outcome.type` and `outcome.reason`. The card network's raw `decline_code` is more granular but less consistent. The high-signal ones:

| Code                                 | Meaning                         | Recoverable?    | Best action                       |
| ------------------------------------ | ------------------------------- | --------------- | --------------------------------- |
| `insufficient_funds`                 | Not enough money on the card    | Yes, with delay | Retry in 3–5 days, T2 with warmth |
| `card_declined` (generic)            | Issuer said no, no reason given | Sometimes       | One retry, then reach out         |
| `expired_card`                       | Card past expiry                | Yes             | Prompt customer to update         |
| `incorrect_cvc` / `incorrect_number` | Typo on manual entry            | Yes             | Ask customer to re-enter          |
| `authentication_required`            | 3DS/SCA needed                  | Yes             | Send confirmation link            |
| `lost_card` / `stolen_card`          | Card flagged                    | No              | Stop retrying immediately         |
| `fraudulent`                         | Issuer suspects fraud           | Rarely          | Do not retry, contact customer    |
| `do_not_honor`                       | Vague issuer refusal            | Sometimes       | One retry after 48h               |
| `processing_error`                   | Transient network issue         | Yes             | Retry in minutes                  |

:::warning
Do NOT retry `lost_card`, `stolen_card`, or `fraudulent`. It will not work, it damages your acceptance rate with the issuer, and repeated attempts can get merchant accounts flagged.
:::

## Retry timing: what actually recovers money

Stripe's built-in Smart Retries are decent. They're not optimal because they don't know your customer.

A better framework:

1. **Immediate retry (5 minutes)** — only for `processing_error` and network-flavored failures.
2. **24-hour retry** — for `insufficient_funds` where the customer likely has a payday cycle.
3. **72-hour retry** — after a customer-facing nudge, for anything requiring their action.
4. **Weekly retry** — one more attempt for high-value invoices; not for $9/mo plans.

The single biggest mistake teams make: **retrying without notifying the customer**. Silent retries recover a small share of insufficient-funds failures and nothing else. Every retry should be paired with a communication.

## The `automatic_payment_methods` era

If you're still building single-method PaymentIntents, upgrade. `automatic_payment_methods` lets Stripe pick the best method (card, Link, wallet, local method) and dramatically reduces friction, especially on retries where the customer has switched devices.

```ts
const intent = await stripe.paymentIntents.create({
  amount: invoice.amount_due,
  currency: invoice.currency,
  customer: invoice.customer,
  automatic_payment_methods: { enabled: true },
});
```

Combined with a hosted **Customer Portal** update-payment-method link, this is the single highest-ROI change most teams can make.

## Instrumenting recovery correctly

Log every retry attempt as its own row, with:

- Invoice ID and subscription ID
- Attempt number in the cadence
- Channel and message ID (email/WhatsApp)
- Decline code on the previous attempt
- Outcome of this attempt

You want to be able to answer "what worked on `insufficient_funds` for annual plans in EMEA last quarter?" without a data engineering project.

## Common footguns

- **Idempotency keys on retries.** Yes, always. `stripe-node` handles this if you pass `{ idempotencyKey }`.
- **Webhook replays.** Stripe retries failed webhook deliveries. Your handler must be idempotent — de-dupe on `event.id`.
- **Test-mode leakage.** Don't share webhook secrets across environments. Ever.
- **Timezone drift on retry schedules.** Store retry times as UTC, present in customer local time in outreach.

---

_This is the reference. The playbook that ties it to messaging and cadence lives in [The AI Revenue Recovery Playbook](/blog/ai-revenue-recovery-playbook)._
