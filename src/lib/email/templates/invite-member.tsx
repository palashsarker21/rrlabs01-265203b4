import * as React from "react";
import { EmailShell, styles, Button, Text } from "./_shell";

export type InviteMemberProps = {
  workspaceName: string;
  inviterName?: string;
  role: string;
  acceptUrl: string;
};

export function InviteMember({ workspaceName, inviterName, role, acceptUrl }: InviteMemberProps) {
  return (
    <EmailShell preview={`You've been invited to ${workspaceName}.`}>
      <Text style={styles.h1}>You're invited to {workspaceName}</Text>
      <Text style={styles.p}>
        {inviterName ? `${inviterName} invited` : "You've been invited"} you to
        join <strong>{workspaceName}</strong> on RRLabs as a{" "}
        <strong>{role}</strong>.
      </Text>
      <Button href={acceptUrl} style={styles.button}>Accept invitation</Button>
      <Text style={styles.p}>This invite expires in 7 days.</Text>
    </EmailShell>
  );
}
