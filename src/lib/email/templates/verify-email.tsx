import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type VerifyEmailProps = { verifyUrl: string };

export function VerifyEmail({ verifyUrl }: VerifyEmailProps) {
  return (
    <EmailShell preview="Confirm your email address to activate your RRLabs account.">
      <Text style={styles.h1}>Verify your email</Text>
      <Text style={styles.p}>
        Click the button below to confirm this email address. The link expires in 24 hours.
      </Text>
      <Button href={verifyUrl} style={styles.button}>
        Verify email
      </Button>
      <Text style={styles.p}>
        If you didn't create an RRLabs account, you can safely ignore this message.
      </Text>
    </EmailShell>
  );
}
