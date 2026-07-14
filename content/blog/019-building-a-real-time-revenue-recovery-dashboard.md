---
title: "Building a Real-Time Revenue Recovery Dashboard"
slug: "building-a-real-time-revenue-recovery-dashboard"
description: "The metrics, event model, and UX rules for a real-time dashboard that helps finance and product teams monitor failed-payment recovery."
keywords:
  [
    "revenue recovery dashboard",
    "real-time saas metrics",
    "recovered revenue",
    "involuntary churn dashboard",
  ]
category: "Analytics"
tags: ["Dashboard", "Analytics", "Metrics", "Recovery"]
author: "RRLabs Editorial"
publishDate: "2026-06-19"
lastModified: "2026-07-14"
featured: false
imageAlt: "Screenshot of the RRLabs recovery dashboard showing recovered revenue and failure funnels"
seoTitle: "Real-Time Revenue Recovery Dashboard (2026 Design)"
seoDescription: "How to design a real-time dashboard for failed-payment recovery — event model, metrics, and UX rules that keep finance and product aligned."
ogTitle: "Real-Time Revenue Recovery Dashboard"
ogDescription: "Design rules for the numbers that matter."
twitterTitle: "Recovery Dashboard Design"
twitterDescription: "Event model, metrics, UX rules."
---

Most subscription businesses know their MRR and their churn. Very few can answer, in real time, "how much revenue did we recover this hour, and from which failure codes." That gap is a $10M-per-year gap for a mid-sized SaaS. A well-designed recovery dashboard closes it.

## Metrics that actually matter

Every real-time recovery dashboard should surface, at minimum:

- **Failures per hour**, split by failure code family.
- **Recovery rate** (successfully recovered ÷ total failed) rolling 24h.
- **Recovered revenue** rolling 24h, 7d, 30d.
- **Time-to-recover distribution** (p50, p90, p99).
- **Cadence attribution** — which channel and step recovered each dollar.
- **Cost per recovered dollar** — network fees, messaging fees, compute.
- **In-grace population** — active grace periods and their expected outcome.

Do not surface "opens" or "clicks" as headline metrics. Those are diagnostic; they are not the point. Recovered revenue is the point.

## The event model

A recovery dashboard is downstream of a clean event stream. The minimum event schema:

```
payment_attempt
  ├─ attempt_id
  ├─ customer_id
  ├─ subscription_id
  ├─ amount_cents
  ├─ currency
  ├─ method (card, sepa, pix, ...)
  ├─ status (succeeded, failed)
  ├─ failure_code (if failed)
  ├─ failure_category (soft_timing, soft_issuer, hard, unknown)
  ├─ attempt_number
  └─ occurred_at

recovery_action
  ├─ action_id
  ├─ attempt_id (fk)
  ├─ channel (email, whatsapp, sms, in_app)
  ├─ template_id
  ├─ sent_at
  ├─ opened_at (nullable)
  ├─ clicked_at (nullable)
  └─ cost_cents

recovery_outcome
  ├─ attempt_id (fk)
  ├─ resolution (recovered, churned, grace_expired, hard_declined)
  ├─ resolved_at
  ├─ resolution_amount_cents
  └─ attributed_action_id (nullable)
```

Attribution — which action gets credit for the recovery — is where dashboards silently disagree with each other. Pick a model, document it, and never change it without a data migration:

- **Last-touch**: the last action before the recovering charge. Simple, biased toward end-of-cadence steps.
- **First-touch**: the first action. Biased toward early emails.
- **Time-decayed**: weighted by recency. More accurate, harder to reason about.

RRLabs uses time-decayed by default (half-life = 24h). Most subscription businesses do fine with last-touch as long as they understand the bias.

## Streaming vs. batch

"Real-time" does not always mean sub-second. For recovery dashboards, the useful definitions are:

- **Sub-minute**: attempts and outcomes as they happen. Required for on-call visibility during incidents.
- **Sub-hour**: aggregated metrics with a 5–15 minute lag. Sufficient for finance and product.
- **Daily**: attribution and cohort views. Fine for weekly ops reviews.

Do not spend engineering budget on sub-second recovery metrics — nobody makes a decision on a payment failure inside 60 seconds. Sub-minute for the event log, sub-hour for the aggregates is the sweet spot.

## UX rules

A recovery dashboard is looked at by three audiences: finance, product, and on-call. Design for all three:

1. **The default view is the current week**, not "all time." All-time numbers hide regressions.
2. **Every metric has a comparison** — vs. previous period, vs. same period last year, or vs. a target.
3. **Failure codes are grouped** by remediation, not by code number. "Insufficient funds" is one row, not fifteen.
4. **Every dashboard element is drillable** to the underlying event stream. If finance disagrees with a number, they can trace it themselves rather than filing a ticket.
5. **Money is money**. Show currency and cents. Do not aggregate USD and EUR into "revenue" without a conversion rate and a timestamp.

## The three graphs every recovery dashboard needs

If the dashboard has room for exactly three charts, make them:

1. **Recovered revenue, 30-day rolling, per day, stacked by failure category.** This is your business.
2. **Recovery funnel, current week**: failures → notified → engaged → recovered. Watch drop-offs.
3. **Time-to-recover histogram, 30 days.** Bimodal is good (fast recoveries + paycheck-aligned recoveries). Unimodal at day 7 means everyone is recovering in the grace period — you are getting lucky, not skilled.

## Alerts that don't cry wolf

Instrument the dashboard with alerts, but pick them carefully:

- **Recovery rate drop > 5% week-over-week** → page the recovery team.
- **Failures spike > 30% hour-over-hour** → page infra + payments; probably a PSP or upstream issue.
- **Deliverability drop > 10% at any major mailbox provider** → page marketing ops.
- **Chargeback rate > 0.7% rolling 30d** → page finance.

Do not alert on absolute numbers. Alert on deltas. A dashboard that pages you every time volume shifts becomes background noise within a week.

## Finance reconciliation

Finance needs the recovery dashboard to reconcile with the general ledger. That means:

- Recovered revenue on the dashboard matches the settlement report from your PSP, within currency-conversion rounding.
- Refunds and chargebacks flow through the same event stream.
- The "recovered" total for a period does not change retroactively — cohort recoveries after the period close are attributed to the _new_ period, not backfilled.

If the dashboard number disagrees with the GL number by more than 1% at month-end, finance stops trusting the dashboard. That is expensive.

## The RRLabs default

The Revenue Recovery Labs dashboard ships with the event schema above, time-decayed attribution, per-currency reconciliation with major PSPs, and a shipped set of alerts calibrated against several years of subscription operating data. It is opinionated by design — the "custom dashboard" phase of any recovery program is where the numbers start disagreeing with each other, and that is the moment recovery stops being a program and starts being a debate.
