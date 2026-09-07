import { prisma } from "@hostpanel/db/client";
import { type EmailJobPayload, getEmailQueue } from "./queues/email";

export type QueueEmailInput = Omit<EmailJobPayload, "emailLogId"> & {
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/**
 * Durably queues a transactional email: an EmailLog row is created first
 * (status QUEUED) so there is a record even if the worker never picks the
 * job up, then the BullMQ job is enqueued carrying that row's id. The
 * worker's email processor updates the same row to SENT/FAILED — see
 * apps/worker/src/processors/email.ts.
 */
export async function queueEmail(tenantId: string, input: QueueEmailInput): Promise<void> {
  const emailLog = await prisma.emailLog.create({
    data: {
      tenantId,
      toEmail: input.to,
      templateKey: input.template,
      subject: input.subject,
      status: "QUEUED",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
  });

  const queue = getEmailQueue();
  await queue.add(input.template, { ...input, emailLogId: emailLog.id } as EmailJobPayload);
}
