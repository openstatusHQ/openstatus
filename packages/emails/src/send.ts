import type React from "react";
import { render } from "react-email";
import { Resend } from "resend";

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
  reply_to?: string;
};
// Indirection so tests can enable delivery against a stubbed Resend client.
export const delivery = {
  enabled: () => env.NODE_ENV === "production",
};

export interface SendOptions {
  /** Resend keeps keys for 24h; a replay with the same key is a no-op. */
  idempotencyKey?: string;
  /** ISO 8601. Resend schedules at most 30 days out. */
  scheduledAt?: string;
}

/** Returns the Resend email id, or undefined when nothing was sent. */
export const sendEmail = async (
  { reply_to, ...email }: Emails,
  opts: SendOptions = {},
) => {
  if (!delivery.enabled()) return;
  const { data, error } = await resend.emails.send(
    {
      ...email,
      ...(reply_to ? { replyTo: reply_to } : {}),
      ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
  // Same key, different body: the first send already went out.
  if (error && error.name !== "invalid_idempotent_request") {
    console.error(`Error sending email "${email.subject}":`, error);
  }
  return data?.id;
};

/** True when the email is cancelled, so the caller may forget its id. */
export const cancelScheduledEmail = async (id: string) => {
  if (!delivery.enabled()) return false;
  const { error } = await resend.emails.cancel(id);
  if (error) console.error(`Error cancelling scheduled email ${id}:`, error);
  return !error;
};

export const sendBatchEmailHtml = async (
  emails: EmailHtml[],
  opts: Pick<SendOptions, "idempotencyKey"> = {},
) => {
  if (!delivery.enabled() || emails.length === 0) return;
  const { error } = await resend.batch.send(
    emails.map(({ reply_to, ...email }) => ({
      ...email,
      ...(reply_to ? { replyTo: reply_to } : {}),
    })),
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
  if (error && error.name !== "invalid_idempotent_request") {
    console.error(`Error sending batch of ${emails.length} emails:`, error);
  }
};

// TODO: delete in favor of sendBatchEmailHtml
export const sendEmailHtml = async (emails: EmailHtml[]) => {
  if (!delivery.enabled()) return;

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
  if (!delivery.enabled()) return;
  const html = await render(email.react);
  await resend.emails.send({
    ...email,
    html,
  });
};
