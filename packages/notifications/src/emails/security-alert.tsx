import React from "react";
import { Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export interface SecurityAlertEmailProps {
  appName: string;
  recipientName: string;
  eventDescription: string;
  ip?: string;
  userAgent?: string;
  occurredAt: string;
}

export default function SecurityAlertEmail({
  appName,
  recipientName,
  eventDescription,
  ip,
  userAgent,
  occurredAt,
}: SecurityAlertEmailProps) {
  return (
    <EmailLayout appName={appName} previewText={`Security alert on your ${appName} account`}>
      <Text>Hi {recipientName},</Text>
      <Text>{eventDescription}</Text>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>
        Time: {occurredAt}
        {ip ? ` · IP: ${ip}` : ""}
        {userAgent ? ` · Device: ${userAgent}` : ""}
      </Text>
      <Text>If this wasn&apos;t you, please reset your password immediately and contact support.</Text>
    </EmailLayout>
  );
}
