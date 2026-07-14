---
title: "Migrating From Stripe Smart Retries to a Custom Recovery Engine"
slug: "migrating-from-stripe-smart-retries-to-custom-recovery"
description: "A step-by-step migration plan for subscription businesses moving from Stripe's built-in Smart Retries and dunning to a custom recovery engine."
keywords: ["stripe smart retries", "custom dunning", "stripe migration", "recovery engine", "billing migration"]
category: "Migration"
tags: ["Stripe", "Migration", "Dunning", "Engineering"]
author: "RRLabs Editorial"
publishDate: "2026-06-21"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of a phased migration from Stripe Smart Retries to a custom recovery engine"
seoTitle: "Migrating From Stripe Smart Retries (2026 Playbook)"
seoDescription: "Move from Stripe's built-in dunning to a custom recovery engine without losing revenue mid-migration."
ogTitle: "Migrating From Stripe Smart Retries"
ogDescription: "The RRLabs step-by-step migration plan."
twitterTitle: "Stripe → Custom Recovery"
twitterDescription: "Migrate without losing revenue mid-flight."
---

Stripe's Smart Retries and built-in dunning are a good default. They are also a **local maximum**. Most subscription businesses that outgrow them delay the migration by 12–18 months, losing eight figures of recoverable revenue in the meantime. Here is how to migrate without breaking anything mid-flight.

## Why teams outgrow Stripe's defaults

Stripe Smart Retries optimizes globally, across all Stripe merchants. That is a rational choice for a payments platform. It is not the optimal choice for **your** business:

- The retry schedule is opaque. You cannot tune it per failure code, per BIN, per plan.
- The email cadence is a single sequence that does not know your product state.
- Channel is email-only. WhatsApp, SMS, and in-app are not part of the flow.
- Attribution is Stripe's, not yours. Your dashboards and Stripe's dashboards will disagree.
- There is no A/B testing. What Stripe ships is what you get.

Companies that move to a custom recovery engine typically recover **20–40% more failed revenue** than Stripe defaults recover for the same customer base. The migration pays for itself in a quarter.

## Phase 0: Turn everything on in Stripe first

Before starting the migration, confirm you have Stripe's own recovery features fully enabled:

- Smart Retries: on.
- Automatic card updater: on (both Visa Account Updater and Mastercard ABU).
- Dunning emails: on, branded, with a real support link.
- Customer portal: on, so users can self-serve card updates.

If Stripe's built-ins are not fully on, turn them on first, measure for 30 days, and use that as your baseline. Migrating from partially-configured Stripe overstates the win from the migration and misleads the executive review.

## Phase 1: Shadow mode

Do not switch off Stripe's recovery on day one. Run the new engine in **shadow mode** for 4–6 weeks:

1. Subscribe to Stripe webhooks for `invoice.payment_failed`, `charge.failed`, and related events.
2. Feed those events into the new engine.
3. The new engine calculates the recovery plan it *would* have executed — retry schedule, channel, copy — and logs it.
4. Stripe continues to execute its own recovery on production traffic.
5. At the end of shadow mode, compare: for each failure, would the custom engine have recovered it faster, slower, or the same as Stripe did?

Shadow mode is invaluable. It surfaces bugs in the custom engine before they touch a customer, calibrates the retry policy against real data, and gives you the internal proof needed to advance to Phase 2.

## Phase 2: Split traffic

Do not cut over 100% on day one. Run a 50/50 split:

- Half of new failures are handled by Stripe's Smart Retries + built-in dunning.
- Half are handled by the custom engine, which now sends real emails and triggers real retries.

Run the split for at least one full month, ideally two, and measure:

- Recovery rate per cell.
- Time-to-recover distribution.
- Chargeback rate per cell (this is where custom engines usually get in trouble first).
- Support ticket volume attributed to recovery messaging.
- Churn rate 60 days post-failure per cell.

If the custom engine wins on recovery rate but loses on chargebacks, do not proceed to Phase 3. Fix the copy and the descriptor first, then re-test.

## Phase 3: Full cutover

Only after the split shows the custom engine wins on recovery rate, matches on chargebacks, and does not increase churn:

1. Turn off Stripe Smart Retries in the Stripe Dashboard.
2. Turn off Stripe dunning emails.
3. Route 100% of failures to the custom engine.
4. Keep Stripe's automatic card updater on — that is a network feature, not a recovery feature, and you always want it.

Keep the customer portal on. It is a Stripe-hosted page for self-serve card updates, and your custom engine's emails should link to it (or your equivalent hosted page) rather than a custom card-input form.

## Retry mechanics after cutover

When your engine wants to retry a charge, it calls the Stripe API directly:

```ts
await stripe.paymentIntents.confirm(paymentIntent.id, {
  payment_method: subscription.default_payment_method,
});
```

Do not use `subscription.pay()` — that re-triggers Stripe's own retry logic, which is off, so nothing happens. Confirm the PaymentIntent explicitly, and record the attempt in your recovery event log.

If the retry succeeds, mark the invoice paid via `invoice.pay({ paid_out_of_band: false })` or let Stripe reconcile via the successful PaymentIntent. If it fails, capture the failure code and schedule the next attempt.

## What breaks in the migration

Two things break for almost every team:

1. **Idempotency**. If the custom engine and Stripe both try to retry the same failed invoice, you get duplicate charges. Solve this by disabling Stripe's retries **before** the engine goes live, and by using Stripe's idempotency keys on every retry API call.
2. **Reconciliation**. The dashboards will disagree for a week. Publish a reconciliation query that ties custom-engine recoveries to Stripe settlements, and share it with finance.

## What you keep from Stripe

Card updater, Radar (fraud), 3DS handling, dispute management, PSP-level tokenization, hosted checkout. Do not build your own versions of any of these. The custom engine is a **recovery layer**; Stripe is still the underlying payments infrastructure.

## The RRLabs default

The Revenue Recovery Labs engine ships with a Stripe migration playbook and connectors that map every Stripe webhook to the engine's event model. Shadow mode is a one-click enable. Split-traffic mode is a routing rule. Full cutover requires a checklist review, deliberately — the last thing anyone wants is a Monday morning where two systems both retried every failure over the weekend.
