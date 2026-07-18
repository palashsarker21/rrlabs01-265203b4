import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type ResetPasswordProps = { resetUrl: string };

export function ResetPassword({ resetUrl }: ResetPasswordProps) {
  return (
    <EmailShell preview="Reset your RRLabs password.">
      <Text style={styles.h1}>Reset your password</Text>
      <Text style={styles.p}>
        We received a request to reset the password for your RRLabs account.
        The link below expires in 1 hour.
      </Text>
      <Button href={resetUrl} style={styles.button}>Reset password</Button>
      <Text style={styles.p}>
        Didn't request this? You can safely ignore this email — your password
        won't change.
      </Text>
    </EmailShell>
  );
}
