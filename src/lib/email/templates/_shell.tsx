import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Button,
} from "@react-email/components";

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: "#0f172a",
  margin: 0,
  padding: 0,
};
const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
};
const brand = {
  fontSize: "18px",
  fontWeight: 700,
  color: "#0ea5a4",
  letterSpacing: "-0.01em",
  marginBottom: "24px",
};
const h1 = {
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "1.3",
  margin: "0 0 12px",
  color: "#0f172a",
};
const p = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#334155",
  margin: "0 0 12px",
};
const button = {
  backgroundColor: "#0ea5a4",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "12px 20px",
  display: "inline-block",
  margin: "16px 0",
};
const hr = { borderColor: "#e2e8f0", margin: "28px 0" };
const footer = { fontSize: "12px", color: "#94a3b8", lineHeight: "1.5" };

export function EmailShell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>RRLabs</Text>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            RRLabs — Cart recovery for modern commerce.
            <br />
            <Link href="https://rrlabs.online" style={{ color: "#0ea5a4" }}>
              rrlabs.online
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = { h1, p, button, hr, footer };
export { Section, Text, Heading, Link, Button, Hr };
