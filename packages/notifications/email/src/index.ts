import type { Monitor, Notification } from "@openstatus/db/src/schema";

import { env } from "../env";
import { EmailConfigurationSchema } from "./schema/config";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
}) => {
  // FIXME:
  const config = EmailConfigurationSchema.parse(JSON.parse(notification.data));
  const { email } = config;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      to: email,
      from: "Notifications <ping@notifications.openstatus.dev>",

      subject: `Your monitor ${monitor.name} is down 🚨`,
      html: `<p>Hi,<br><br>Your monitor ${monitor.name} is down. </p><p>URL : ${
        monitor.url
      }</p> ${
        statusCode
          ? `<p>Status Code: ${statusCode}</p>`
          : `<p>Error message: ${message}</p>`
      }<p>OpenStatus 🏓 </p>`,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(data);
    // return NextResponse.json(data);
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
}) => {
  // FIXME:
  const config = EmailConfigurationSchema.parse(JSON.parse(notification.data));
  const { email } = config;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      to: email,
      from: "Notifications <ping@openstatus.dev>",

      subject: `Your monitor ${monitor.name} is back up 🎉`,
      html: `<p>Hi,<br><br>Your monitor ${monitor.name} is up again  </p><p>URL : ${monitor.url}</p> <p>OpenStatus 🏓 </p>`,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(data);
    // return NextResponse.json(data);
  }
};
