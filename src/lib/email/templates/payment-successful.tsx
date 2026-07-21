import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type PaymentSuccessfulProps = {
  amountFormatted: string;
  invoiceUrl?: string;
  period?: string;
};

export function PaymentSuccessful({ amountFormatted, invoiceUrl, period }: PaymentSuccessfulProps) {
  return (
    <EmailShell preview="Payment received.">
      <Text style={styles.h1}>Payment received</Text>
      <Text style={styles.p}>
        Thank you — we received <strong>{amountFormatted}</strong>
        {period ? ` for ${period}` : ""}. Your subscription is fully paid up.
      </Text>
      {invoiceUrl ? (
        <Button href={invoiceUrl} style={styles.button}>
          Download invoice
        </Button>
      ) : null}
    </EmailShell>
  );
}
