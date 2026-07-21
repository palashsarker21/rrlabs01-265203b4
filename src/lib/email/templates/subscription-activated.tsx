import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type SubscriptionActivatedProps = {
  planName: string;
  amountFormatted: string;
  nextBillingDate?: string;
  manageUrl: string;
};

export function SubscriptionActivated({
  planName,
  amountFormatted,
  nextBillingDate,
  manageUrl,
}: SubscriptionActivatedProps) {
  return (
    <EmailShell preview={`Your ${planName} plan is active.`}>
      <Text style={styles.h1}>Welcome to {planName} 🎉</Text>
      <Text style={styles.p}>
        Your subscription is active at <strong>{amountFormatted}</strong>
        {nextBillingDate ? `. Next billing date: ${nextBillingDate}.` : "."}
      </Text>
      <Button href={manageUrl} style={styles.button}>
        Manage subscription
      </Button>
    </EmailShell>
  );
}
