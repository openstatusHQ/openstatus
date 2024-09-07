import type React from "react";
import { Resend } from "resend";

import { env } from "../env";

export const resend = new Resend(env.RESEND_API_KEY);

export interface Emails {
  react: React.JSX.Element;
  subject: string;
  to: string[];
  from: string;
}

export type EmailHtml = {
  html: string;
  subject: string;
  to: string;
  from: string;
};
export const sendEmail = async (email: Emails) => {
  await resend.emails.send(email);
};

export const sendBatchEmailHtml = async (emails: EmailHtml[]) => {
  await resend.batch.send(emails);
};

export const sendEmailHtml = async (email: EmailHtml) => {
  await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      to: email.to,
      from: email.from,
      subject: email.subject,
      html: email.html,
    }),
  });
};
