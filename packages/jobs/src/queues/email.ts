import { Queue } from "bullmq";
import type { ResetPasswordEmailProps } from "@hostpanel/notifications/emails/reset-password";
import type { SecurityAlertEmailProps } from "@hostpanel/notifications/emails/security-alert";
import type { StaffInviteEmailProps } from "@hostpanel/notifications/emails/staff-invite";
import type { VerifyEmailProps } from "@hostpanel/notifications/emails/verify-email";
import type { WelcomeEmailProps } from "@hostpanel/notifications/emails/welcome";
import { getRedisConnection } from "../connection";

export const EMAIL_QUEUE_NAME = "email";

export type EmailJobPayload =
  | { emailLogId: string; to: string; subject: string; template: "verify_email"; props: VerifyEmailProps }
  | {
      emailLogId: string;
      to: string;
      subject: string;
      template: "reset_password";
      props: ResetPasswordEmailProps;
    }
  | { emailLogId: string; to: string; subject: string; template: "welcome"; props: WelcomeEmailProps }
  | {
      emailLogId: string;
      to: string;
      subject: string;
      template: "staff_invite";
      props: StaffInviteEmailProps;
    }
  | {
      emailLogId: string;
      to: string;
      subject: string;
      template: "security_alert";
      props: SecurityAlertEmailProps;
    };

let emailQueue: Queue<EmailJobPayload> | undefined;

export function getEmailQueue(): Queue<EmailJobPayload> {
  emailQueue ??= new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    },
  });
  return emailQueue;
}
