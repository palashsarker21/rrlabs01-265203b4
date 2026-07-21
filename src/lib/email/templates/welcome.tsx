import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type WelcomeProps = { name?: string; ctaUrl?: string };

export function Welcome({ name, ctaUrl = "https://rrlabs.online/app" }: WelcomeProps) {
  return (
    <EmailShell preview="Welcome to RRLabs — let's recover more revenue.">
      <Text style={styles.h1}>Welcome{name ? `, ${name}` : ""} 👋</Text>
      <Text style={styles.p}>
        Thanks for joining RRLabs. Your workspace is ready — connect your store and start recovering
        abandoned carts today.
      </Text>
      <Button href={ctaUrl} style={styles.button}>
        Open your dashboard
      </Button>
      <Text style={styles.p}>
        Need help getting started? Reply to this email — a real human will answer.
      </Text>
    </EmailShell>
  );
}
