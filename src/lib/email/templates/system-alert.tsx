import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type SystemAlertProps = {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  actionUrl?: string;
};

export function SystemAlert({ title, message, severity, actionUrl }: SystemAlertProps) {
  const color =
    severity === "critical" ? "#dc2626" : severity === "warning" ? "#d97706" : "#0284c7";
  return (
    <EmailShell preview={`[${severity.toUpperCase()}] ${title}`}>
      <Text style={{ ...styles.h1, color }}>{title}</Text>
      <Text style={styles.p}>{message}</Text>
      {actionUrl ? (
        <Button href={actionUrl} style={styles.button}>View in RRLabs</Button>
      ) : null}
    </EmailShell>
  );
}
