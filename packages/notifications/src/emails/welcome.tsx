import React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface WelcomeEmailProps {
  appName: string;
  recipientName: string;
  loginUrl: string;
}

export default function WelcomeEmail({ appName, recipientName, loginUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout appName={appName} previewText={`Welcome to ${appName}`}>
      <Text>Hi {recipientName},</Text>
      <Text>
        Your email is verified and your {appName} account is ready. You can now browse products,
        place orders, and manage your services from the client portal.
      </Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button
          href={loginUrl}
          style={{
            backgroundColor: "#4f46e5",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Go to client portal
        </Button>
      </Section>
    </EmailLayout>
  );
}
