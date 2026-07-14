---
title: "Webhook Reliability Patterns for Payment Systems"
slug: "webhook-reliability-patterns-for-payment-systems"
description: "How to receive, verify, deduplicate, and retry payment webhooks so no revenue event is ever silently lost."
keywords: ["webhook reliability", "stripe webhooks", "idempotency", "webhook retry", "payment events"]
category: "Engineering"
tags: ["Webhooks", "Reliability", "Payments", "Engineering"]
author: "RRLabs Editorial"
publishDate: "2026-06-29"
lastModified: "2026-07-14"
featured: false
imageAlt: "Diagram of a resilient webhook ingestion pipeline"
seoTitle: "Webhook Reliability for Payment Systems (2026 Playbook)"
seoDescription: "Receive, verify, deduplicate, and retry payment webhooks so no revenue event is ever silently lost."
ogTitle: "Webhook Reliability Patterns"
ogDescription: "For payment systems that cannot afford to lose an event."
twitterTitle: "Webhook Reliability"
twitterDescription: "Verify, dedupe, retry — done right."
---

A missed payment webhook is a missed reconciliation, a missed dunning trigger, or a duplicate charge — pick your favorite way to lose money. Payment systems must treat webhook ingestion as a first-class reliability problem, not an integration afterthought.

## The four failure modes

Every payment webhook integration has to defend against:

1. **Signature forgery** — an attacker posts fake events to your endpoint.
2. **Delivery duplicates** — the sender retries; you receive the same event twice.
3. **Out-of-order delivery** — event B arrives before event A.
4. **Missed events** — network partition, endpoint down, sender gives up.

Solve all four. Missing any one produces silent revenue loss.

## Verify signatures, always

Every major PSP signs webhooks. Verify the signature before doing anything with the payload:

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyStripeSignature(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(kv => kv.split("=")));
  const signed = `${parts.t}.${body}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
```

Two rules:

- Use `timingSafeEqual`, not `===`. Timing-safe comparison prevents timing-oracle attacks that recover the secret one byte at a time.
- Verify the **raw body**, not the parsed JSON. Middleware that parses first and re-stringifies later reorders keys and breaks verification silently.

## Deduplicate on event ID

Every PSP-generated event has an ID. Store received event IDs in a table with a unique index; drop duplicates on insertion:

```sql
CREATE TABLE webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  received_at timestamptz DEFAULT now()
);

INSERT INTO webhook_events (id, provider) VALUES ($1, 'stripe')
ON CONFLICT (id) DO NOTHING;
```

If the insert affects zero rows, the event is a duplicate — return 200 and skip processing. Return 200, not 4xx: telling the sender the request was invalid causes it to retry.

## Handle out-of-order events

Payment events do not always arrive in the order they occurred. A `charge.succeeded` can arrive before `payment_intent.created` under load. Your handlers must be tolerant:

- Store the event, do not process it yet.
- Process events in order of their `created` timestamp, not order of arrival.
- Handle missing prerequisites by fetching the object from the PSP API, not by ignoring the event.

If you must process synchronously (rare), design each handler to be self-sufficient — a `charge.succeeded` handler that requires a `payment_intent` record to exist should fetch the PaymentIntent from Stripe if the local record is missing.

## Return 200 fast, process async

The single most important pattern in webhook reliability: **return 200 within a few hundred milliseconds** and process the payload asynchronously.

```ts
app.post("/webhooks/stripe", async (req, res) => {
  if (!verifySignature(req)) return res.status(400).end();
  await enqueue("stripe_events", req.body);
  res.status(200).end();
});
```

Reasons:

- PSPs enforce timeouts (Stripe: 30s; most others 5–15s). A slow handler eventually gets marked as failing and the PSP disables the endpoint.
- Retries pile up if you respond slowly, causing duplicate processing.
- The signature verification path stays in the hot path; business logic goes in a worker.

The queue can be Postgres, SQS, Redis Streams, whatever your stack already runs. The key property is that the ingestion endpoint does no business logic.

## Reconcile with the PSP daily

Even with all four patterns in place, you will occasionally miss events. Network partitions happen. Deploys drop connections. The PSP's own delivery system has outages.

The defense is a **daily reconciliation job**:

1. Pull the list of PSP events for the previous day via the PSP API.
2. Diff against your local `webhook_events` table.
3. Any event ID in the PSP list but not in your table is a miss — replay it through the same handler.

Reconciliation is not glamorous. It is what stops one missed webhook per year from becoming one missed webhook per year that snowballs into a $50K reconciliation error.

## Idempotent handlers, not just idempotent ingestion

Deduplication at the ingestion layer prevents processing the same event twice, but the *handler* must still be idempotent. If a network blip causes a partial processing (event stored, downstream side effect not applied), reprocessing must produce the correct outcome.

Rules:

- Downstream side effects (send email, charge card, create invoice) must be keyed by the event ID or a natural key from the event.
- Database writes should be upserts, not blind inserts.
- Sending an email is not idempotent — gate it on a `notifications_sent` row keyed by (event_id, template).

## Error handling and dead-letter queues

Handlers fail. Bugs, downstream outages, malformed payloads. Have a plan:

- Retry the same event N times with exponential backoff.
- After N failures, move to a dead-letter queue.
- Alert on the DLQ depth, not on individual failures.
- Provide a UI or CLI to replay from the DLQ after fixing the bug.

Never silently drop failing events. Never `try/catch` a handler with an empty body. Every failure must land somewhere a human will notice.

## Endpoint hygiene

- Serve webhook endpoints from a dedicated subdomain (`hooks.company.com`), not the app domain. Rate-limiting policies differ.
- Do not put webhook endpoints behind auth middleware — signature verification is the auth.
- Do not require CORS preflight — webhooks are server-to-server.
- Log the raw body plus headers to a durable store for 30 days. When you need to debug a signature failure, you will need the exact bytes the sender posted.

## The RRLabs default

The Revenue Recovery Labs webhook layer verifies signatures with constant-time comparison, dedupes on event ID with a Postgres unique constraint, enqueues to a worker pool with per-tenant isolation, retries with exponential backoff, and runs a daily reconciliation against every connected PSP. No event has been silently lost in production. That is not luck — it is the four patterns above, applied every time.
