import {
  type Monitor,
  type Notification,
  emailDataSchema,
} from "@openstatus/db/src/schema";

import { env } from "../env";

async function send({
  subject,
  html,
  email,
  id,
  type,
}: {
  subject: string;
  html: string;
  email: string;
  id: number;
  type: "recovered" | "alert" | "degraded";
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      to: email,
      from: "Notifications <ping@openstatus.dev>",
      subject,
      html,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(data);
    // return NextResponse.json(data);
  }
  if (!res.ok) {
    console.log(`Error sending ${type} email ${id}`);
  }
}

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  cronTimestamp,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  await send({
    id: monitor.id,
    type: "alert",
    email: config.data.email,
    subject: `🚨 Alert ${monitor.name}`,
    html: `
    <p>Hi,</p>
    <p>Your monitor <strong>${monitor.name}</strong> is down.</p>
    <p>URL: ${monitor.url}</p>
      ${
        statusCode
          ? `<p>Status Code: ${statusCode}</p>`
          : `<p>Error message: ${message}</p>`
      }
    <p>Cron Timestamp: ${cronTimestamp} (${new Date(cronTimestamp).toISOString()})</p>
    <p>OpenStatus 🏓</p>`,
  });
};

export const sendRecovery = async ({
  monitor,
  notification,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  send({
    id: monitor.id,
    type: "recovered",
    email: config.data.email,
    subject: `✅ Recovered ${monitor.name}`,
    html: `
      <p>Hi,</p>
      <p>Your monitor <strong>${monitor.name}</strong> is up again.</p>
      <p>URL: ${monitor.url}</p>
      <p>OpenStatus 🏓</p>
    `,
  });
};

export const sendDegraded = async ({
  monitor,
  notification,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  cronTimestamp: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  send({
    id: monitor.id,
    type: "degraded",
    email: config.data.email,
    subject: `⚠️ Degraded ${monitor.name}`,
    html: `
      <p>Hi,</p>
      <p>Your monitor <strong>${monitor.name}</strong> is taking longer than expected to respond</p>
      <p>URL: ${monitor.url}</p>
      <p>OpenStatus 🏓</p>
    `,
  });
};
