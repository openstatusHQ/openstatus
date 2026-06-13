import nodemailer from "nodemailer";
import type React from "react";
import { render } from "react-email";
import { Resend } from "resend";
import { chunk } from "./utils";
import { env } from "./env";

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const smtpTransporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ? Number.parseInt(env.SMTP_PORT, 10) || 587 : 587,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    })
  : null;

if (!resendClient && !smtpTransporter && process.env.NODE_ENV === "production") {
  throw new Error("Either RESEND_API_KEY or SMTP_HOST must be provided.");
}

export interface Emails {
  react: React.JSX.Element;
  subject: string;
  to: string[];
  from: string;
  reply_to?: string;
}

export type EmailHtml = {
  html: string;
  subject: string;
  to: string;
  from: string;
  reply_to?: string;
};


export const sendEmail = async (email: Emails) => {
  if (process.env.NODE_ENV !== "production") return;
  const html = await render(email.react);
  if (smtpTransporter) {
    await smtpTransporter.sendMail({
      from: env.SMTP_FROM || email.from,
      to: email.to.join(","),
      subject: email.subject,
      html,
      replyTo: email.reply_to,
    });
    }else if (resendClient){
    await resendClient.emails.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      html,
      replyTo: email.reply_to,
    });
  }
};

export const sendBatchEmailHtml = async (emails: EmailHtml[]) => {
  if (process.env.NODE_ENV !== "production") return;
  if (smtpTransporter) {
  const chunks = chunk(emails, 10); // 10 concurrent at a time
  for (const batch of chunks) {
    await Promise.all(batch.map((email) =>
      smtpTransporter.sendMail({
        from: env.SMTP_FROM || email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: email.reply_to,
      })
    ));
  }
} else if (resendClient) {
    await resendClient.batch.send(
      emails.map((email) => ({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        replyTo: email.reply_to,
      }))
    );
  }
};
