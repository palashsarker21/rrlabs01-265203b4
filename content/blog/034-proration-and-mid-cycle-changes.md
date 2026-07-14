---
title: "Proration and Mid-Cycle Changes: The Math That Breaks Every Billing System"
slug: "proration-and-mid-cycle-changes"
description: "Upgrades, downgrades, seat changes, and plan swaps mid-cycle — the edge cases that eat engineering time and customer trust."
keywords: ["proration", "mid-cycle upgrade", "subscription proration", "billing math", "stripe proration"]
category: "Engineering"
tags: ["Billing", "Proration", "Engineering", "Subscriptions"]
author: "RRLabs Engineering"
publishDate: "2026-07-04"
lastModified: "2026-07-14"
featured: false
imageAlt: "Proration timeline visualization"
seoTitle: "Proration and Mid-Cycle Changes in Subscription Billing"
seoDescription: "The math and edge cases of subscription proration — upgrades, downgrades, seat changes."
ogTitle: "Proration and Mid-Cycle Changes"
ogDescription: "The math that breaks every billing system."
twitterTitle: "Proration and Mid-Cycle Changes"
twitterDescription: "The math that breaks every billing system."
---

Proration is where most billing bugs live. The rules sound simple — charge the difference — until you handle upgrades, downgrades, mid-cycle cancels, seat swaps, and coupons interacting with all four.

## The four models

**Immediate with proration:** charge the delta now, credit unused time. Standard for upgrades.

**Immediate without proration:** charge full new price now, discard unused time. Aggressive; only for downgrades to lower tier.

**Next cycle:** change applies at renewal. Cleanest, worst UX for upgrades ("but I want it now").

**Custom period alignment:** align mid-cycle change to a fixed anchor (calendar month, contract renewal). Enterprise pattern.

Pick one primary and document the exceptions.

## The formula

Unused-time credit:
```
credit = (old_price / period_length_in_days) * days_remaining
```

New-period charge:
```
charge = (new_price / period_length_in_days) * days_remaining
```

Net:
```
proration_amount = charge - credit
```

## The edge cases that break it

- **Leap years:** period_length_in_days is 365 or 366. Use actual days in the current billing period, not a constant.
- **Timezone boundaries:** "days remaining" is undefined across DST. Anchor to UTC.
- **Refunded credits:** if the original charge was partially refunded, credit is on the *net* paid, not gross.
- **Coupons and discounts:** apply after proration, not before. Otherwise upgrades give free money.
- **Seat additions in the last hour:** most systems charge a full day's proration for adding a seat 30 seconds before renewal. Add a "no-op window" of the last 4 hours.
- **Downgrades below current usage:** what happens to seats/features already in use? Grandfather until renewal, don't kick users out.

## Coupons and proration together

The interaction rule most systems get wrong:

1. Calculate the base proration on undiscounted prices.
2. Apply percentage discounts to the *charge* portion, not the credit portion.
3. Fixed-amount discounts stay on the original schedule and don't multiply.

Otherwise a 100%-off coupon on a $100 upgrade nets to a $50 refund, which is not what anyone intended.

## The UX rule

Show the customer the exact math **before** they confirm. Every upgrade dialog should include:

```
Prorated charge today:    $47.19
  New plan (10 days):     $80.55
  Credit unused Pro:     -$33.36
Next renewal (Mar 1):     $199.00
```

Customers accept complex billing when it's explicit. They dispute what surprises them.

## Testing proration

Write tests that cover:

- Upgrade on day 1 of period
- Upgrade on last day of period
- Downgrade mid-period
- Upgrade + downgrade in same period
- Coupon applied before upgrade
- Coupon applied after upgrade
- Refunded prior invoice + upgrade
- Seat change of +1, -1, +10, -10
- Change across DST boundary
- Change across leap-day

If any test is missing, that's the next customer complaint.
