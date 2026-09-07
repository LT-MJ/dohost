import React from "react";
import { Body, Container, Head, Hr, Html, Preview, Text } from "@react-email/components";
import type { ReactNode } from "react";

export const emailColors = {
  bg: "#f4f5f7",
  card: "#ffffff",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  brand: "#4f46e5",
};

export function EmailLayout({
  previewText,
  appName,
  children,
}: {
  previewText: string;
  appName: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: emailColors.bg,
          fontFamily: "Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: emailColors.card,
            borderRadius: 8,
            border: `1px solid ${emailColors.border}`,
            maxWidth: 480,
            margin: "0 auto",
            padding: 32,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 700, color: emailColors.text, margin: "0 0 24px" }}>
            {appName}
          </Text>
          {children}
          <Hr style={{ borderColor: emailColors.border, margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 12, color: emailColors.muted, margin: 0 }}>
            If you didn&apos;t request this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
