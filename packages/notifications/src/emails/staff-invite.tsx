import React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface StaffInviteEmailProps {
  appName: string;
  recipientName: string;
  roleName: string;
  setPasswordUrl: string;
}

export default function StaffInviteEmail({
  appName,
  recipientName,
  roleName,
  setPasswordUrl,
}: StaffInviteEmailProps) {
  return (
    <EmailLayout appName={appName} previewText={`You've been added to ${appName}`}>
      <Text>Hi {recipientName},</Text>
      <Text>
        An administrator created a staff account for you on {appName} with the{" "}
        <strong>{roleName}</strong> role. Set your password to finish activating it.
      </Text>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button
          href={setPasswordUrl}
          style={{
            backgroundColor: "#4f46e5",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Set your password
        </Button>
      </Section>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>This link expires in 24 hours.</Text>
    </EmailLayout>
  );
}
