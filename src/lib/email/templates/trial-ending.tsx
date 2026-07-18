import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type TrialEndingProps = { daysLeft: number; upgradeUrl: string };

export function TrialEnding({ daysLeft, upgradeUrl }: TrialEndingProps) {
  return (
    <EmailShell preview={`Your RRLabs trial ends in ${daysLeft} day(s).`}>
      <Text style={styles.h1}>Your trial ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}</Text>
      <Text style={styles.p}>
        Choose a plan to keep recovering revenue without interruption. All
        connected integrations and history stay in place.
      </Text>
      <Button href={upgradeUrl} style={styles.button}>Choose a plan</Button>
    </EmailShell>
  );
}
