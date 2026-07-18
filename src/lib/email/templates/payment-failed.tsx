import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type PaymentFailedProps = {
  reason?: string;
  updateUrl: string;
  gracePeriodDays?: number;
};

export function PaymentFailed({ reason, updateUrl, gracePeriodDays = 7 }: PaymentFailedProps) {
  return (
    <EmailShell preview="Your payment failed — action required.">
      <Text style={styles.h1}>Payment failed</Text>
      <Text style={styles.p}>
        We couldn't process your last RRLabs payment
        {reason ? ` (${reason})` : ""}. Update your payment method within{" "}
        <strong>{gracePeriodDays} days</strong> to keep the recovery engine
        running.
      </Text>
      <Button href={updateUrl} style={styles.button}>Update payment method</Button>
    </EmailShell>
  );
}
