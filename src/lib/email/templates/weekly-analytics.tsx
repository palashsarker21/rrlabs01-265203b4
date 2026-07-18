import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type WeeklyAnalyticsProps = {
  workspaceName: string;
  recoveredFormatted: string;
  eventsCount: number;
  recoveredCount: number;
  dashboardUrl: string;
};

export function WeeklyAnalytics({
  workspaceName,
  recoveredFormatted,
  eventsCount,
  recoveredCount,
  dashboardUrl,
}: WeeklyAnalyticsProps) {
  return (
    <EmailShell preview={`Weekly recovery report for ${workspaceName}.`}>
      <Text style={styles.h1}>Weekly report — {workspaceName}</Text>
      <Text style={styles.p}>
        Recovered revenue: <strong>{recoveredFormatted}</strong>
        <br />
        Recovered carts: <strong>{recoveredCount}</strong> of {eventsCount} events
      </Text>
      <Button href={dashboardUrl} style={styles.button}>Open dashboard</Button>
    </EmailShell>
  );
}
