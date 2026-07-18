import * as React from "react";
import { EmailShell, styles, Text } from "./_shell";

export type ContactMessageProps = {
  fromName: string;
  fromEmail: string;
  message: string;
  companyName?: string;
};

export function ContactMessage({ fromName, fromEmail, message, companyName }: ContactMessageProps) {
  return (
    <EmailShell preview={`New contact form message from ${fromName}`}>
      <Text style={styles.h1}>New contact form message</Text>
      <Text style={styles.p}>
        <strong>From:</strong> {fromName} &lt;{fromEmail}&gt;
        {companyName ? <><br /><strong>Company:</strong> {companyName}</> : null}
      </Text>
      <Text style={{ ...styles.p, whiteSpace: "pre-wrap" as const }}>{message}</Text>
    </EmailShell>
  );
}
