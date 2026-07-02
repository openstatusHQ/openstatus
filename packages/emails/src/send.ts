import { Autosend } from "autosendjs";
import type React from "react";

import { toEmailAddress } from "./client";
import { env } from "./env";

const client = new Autosend(env.RESEND_API_KEY, { maxRetries: 1 });

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
  await client.emails.send({
    from: toEmailAddress(email.from),
    to: email.to.map((address) => toEmailAddress(address)),
    subject: email.subject,
    react: email.react,
    replyTo: email.reply_to ? toEmailAddress(email.reply_to) : undefined,
  });
};

export const sendBatchEmailHtml = async (emails: EmailHtml[]) => {
  if (process.env.NODE_ENV !== "production") return;
  for (const email of emails) {
    await client.emails.send({
      from: toEmailAddress(email.from),
      to: toEmailAddress(email.to),
      subject: email.subject,
      html: email.html,
      replyTo: email.reply_to ? toEmailAddress(email.reply_to) : undefined,
    });
  }
};
