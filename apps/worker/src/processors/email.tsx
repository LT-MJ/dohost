import React from "react";
import { Worker, type Job } from "bullmq";
import { prisma } from "@hostpanel/db/client";
import { getRedisConnection, type EmailJobPayload } from "@hostpanel/jobs";
import { createLogger } from "@hostpanel/shared/logger";
import { sendEmail, type SendEmailResult } from "@hostpanel/notifications";
import ResetPasswordEmail from "@hostpanel/notifications/emails/reset-password";
import SecurityAlertEmail from "@hostpanel/notifications/emails/security-alert";
import StaffInviteEmail from "@hostpanel/notifications/emails/staff-invite";
import VerifyEmailEmail from "@hostpanel/notifications/emails/verify-email";
import WelcomeEmail from "@hostpanel/notifications/emails/welcome";
import { EMAIL_QUEUE_NAME } from "@hostpanel/jobs";

const log = createLogger("worker:email");

function renderTemplate(payload: EmailJobPayload) {
  switch (payload.template) {
    case "verify_email":
      return <VerifyEmailEmail {...payload.props} />;
    case "reset_password":
      return <ResetPasswordEmail {...payload.props} />;
    case "welcome":
      return <WelcomeEmail {...payload.props} />;
    case "staff_invite":
      return <StaffInviteEmail {...payload.props} />;
    case "security_alert":
      return <SecurityAlertEmail {...payload.props} />;
  }
}

export function startEmailWorker(): Worker<EmailJobPayload, SendEmailResult> {
  const worker = new Worker<EmailJobPayload, SendEmailResult>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const react = renderTemplate(job.data);
      return sendEmail({ to: job.data.to, subject: job.data.subject, react });
    },
    { connection: getRedisConnection(), concurrency: 5 },
  );

  worker.on("completed", (job, result) => {
    prisma.emailLog
      .update({
        where: { id: job.data.emailLogId },
        data: {
          status: "SENT",
          providerMessageId: result.messageId,
          sentAt: new Date(),
          attempts: job.attemptsMade,
        },
      })
      .catch((err: unknown) => log.error({ err, jobId: job.id }, "failed to update EmailLog after send"));
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) {
      log.warn({ jobId: job.id, attempt: job.attemptsMade, err }, "email send attempt failed, will retry");
      return;
    }
    prisma.emailLog
      .update({
        where: { id: job.data.emailLogId },
        data: { status: "FAILED", error: err.message, attempts: job.attemptsMade },
      })
      .catch((updateErr: unknown) =>
        log.error({ updateErr, jobId: job.id }, "failed to update EmailLog after final failure"),
      );
    log.error({ jobId: job.id, err }, "email send failed permanently");
  });

  return worker;
}
