import { render } from "@react-email/render";
import type { ReactElement } from "react";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { getEnv } from "@hostpanel/shared/config";
import { IntegrationError } from "@hostpanel/shared/errors";

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export interface SendEmailResult {
  provider: "resend" | "smtp";
  messageId: string;
}

let resendClient: Resend | undefined;
let smtpTransport: Transporter | undefined;

/**
 * Renders and sends an email through whichever provider is configured
 * (EMAIL_PROVIDER). Throws IntegrationError — never silently "succeeds" —
 * when the selected provider has no credentials configured, so callers
 * (the worker's email job) can mark the EmailLog row failed and surface it
 * rather than pretending delivery happened.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = getEnv();
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);

  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new IntegrationError({
        code: "email.not_configured",
        message: "Email delivery is not configured.",
        meta: { provider: "resend" },
      });
    }
    resendClient ??= new Resend(env.RESEND_API_KEY);
    const result = await resendClient.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
    if (result.error) {
      throw new IntegrationError({
        code: "email.send_failed",
        message: "Failed to send email.",
        meta: { provider: "resend", error: result.error },
      });
    }
    return { provider: "resend", messageId: result.data?.id ?? "" };
  }

  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    throw new IntegrationError({
      code: "email.not_configured",
      message: "Email delivery is not configured.",
      meta: { provider: "smtp" },
    });
  }
  smtpTransport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  try {
    const info = await smtpTransport.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
    return { provider: "smtp", messageId: info.messageId };
  } catch (cause) {
    throw new IntegrationError({
      code: "email.send_failed",
      message: "Failed to send email.",
      cause,
      meta: { provider: "smtp" },
    });
  }
}
