import React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface VerifyEmailProps {
  appName: string;
  recipientName: string;
  verifyUrl: string;
}

export default function VerifyEmailEmail({ appName, recipientName, verifyUrl }: VerifyEmailProps) {
  return (
    <EmailLayout appName={appName} previewText={`Verify your email for ${appName}`}>
      <Text>Hi {recipientName},</Text>
      <Text>Please confirm your email address to activate your account.</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button
          href={verifyUrl}
          style={{
            backgroundColor: "#4f46e5",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Verify email address
        </Button>
      </Section>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>This link expires in 24 hours.</Text>
    </EmailLayout>
  );
}
