import type React from "react";
import { Resend } from "resend";

import { render } from "@react-email/render";
import { env } from "./env";

// Lazy initialization to avoid errors during build when API key is not set
let _resend: Resend | null = null;
export const getResend = () => {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
};

// Keep for backwards compatibility but use lazy initialization
export const resend = {
  get emails() {
    return getResend().emails;
  },
  get batch() {
    return getResend().batch;
  },
};

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
