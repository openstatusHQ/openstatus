import type React from "react";
import { Resend } from "resend";

import { render } from "@react-email/render";
import { env } from "./env";

export const resend = new Resend(env.RESEND_API_KEY);

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
};
export const sendEmail = async (email: Emails) => {
  if (process.env.NODE_ENV !== "production") return;
  await resend.emails.send(email);
};

export const sendBatchEmailHtml = async (emails: EmailHtml[]) => {
  if (process.env.NODE_ENV !== "production") return;
  await resend.batch.send(emails);
};

// TODO: delete in favor of sendBatchEmailHtml
export const sendEmailHtml = async (emails: EmailHtml[]) => {
  if (process.env.NODE_ENV !== "production") return;

  await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(emails),
  });
};

export const sendWithRender = async (email: Emails) => {
  if (process.env.NODE_ENV !== "production") return;
  const html = await render(email.react);
  await resend.emails.send({
    ...email,
    html,
  });
};
