import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type SuccessFeeInvoiceProps = {
  period: string;
  recoveredFormatted: string;
  feeFormatted: string;
  invoiceUrl?: string;
};

export function SuccessFeeInvoice({
  period,
  recoveredFormatted,
  feeFormatted,
  invoiceUrl,
}: SuccessFeeInvoiceProps) {
  return (
    <EmailShell preview={`Success fee statement for ${period}.`}>
      <Text style={styles.h1}>Success fee statement — {period}</Text>
      <Text style={styles.p}>
        Recovered revenue this period: <strong>{recoveredFormatted}</strong>
        <br />
        Success fee due: <strong>{feeFormatted}</strong>
      </Text>
      {invoiceUrl ? (
        <Button href={invoiceUrl} style={styles.button}>
          View statement
        </Button>
      ) : null}
      <Text style={styles.p}>You're only billed on revenue we actually recover for you.</Text>
    </EmailShell>
  );
}
