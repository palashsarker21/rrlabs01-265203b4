import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type TrialStartedProps = { name?: string; endsAt: string; ctaUrl?: string };

export function TrialStarted({
  name,
  endsAt,
  ctaUrl = "https://rrlabs.online/app",
}: TrialStartedProps) {
  return (
    <EmailShell preview="Your 14-day RRLabs trial has started.">
      <Text style={styles.h1}>Your trial is live{name ? `, ${name}` : ""}</Text>
      <Text style={styles.p}>
        You have full access to RRLabs until <strong>{endsAt}</strong>. Connect your store to start
        recovering carts immediately.
      </Text>
      <Button href={ctaUrl} style={styles.button}>
        Complete setup
      </Button>
    </EmailShell>
  );
}
