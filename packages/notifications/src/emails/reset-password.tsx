import React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface ResetPasswordEmailProps {
  appName: string;
  recipientName: string;
  resetUrl: string;
}

export default function ResetPasswordEmail({
  appName,
  recipientName,
  resetUrl,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout appName={appName} previewText={`Reset your ${appName} password`}>
      <Text>Hi {recipientName},</Text>
      <Text>We received a request to reset your password. Click below to choose a new one.</Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: "#4f46e5",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Reset password
        </Button>
      </Section>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>
        This link expires in 1 hour. If you didn&apos;t request a password reset, please contact
        support immediately.
      </Text>
    </EmailLayout>
  );
}
