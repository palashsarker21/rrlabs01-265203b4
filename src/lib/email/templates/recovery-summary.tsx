import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type RecoverySummaryProps = {
  workspaceName: string;
  period: string;
  recoveredFormatted: string;
  attempts: number;
  dashboardUrl: string;
};

export function RecoverySummary({ workspaceName, period, recoveredFormatted, attempts, dashboardUrl }: RecoverySummaryProps) {
  return (
    <EmailShell preview={`Recovery summary — ${period}.`}>
      <Text style={styles.h1}>{workspaceName} — {period}</Text>
      <Text style={styles.p}>
        Recovered: <strong>{recoveredFormatted}</strong> across{" "}
        <strong>{attempts}</strong> recovery attempts.
      </Text>
      <Button href={dashboardUrl} style={styles.button}>View details</Button>
    </EmailShell>
  );
}
