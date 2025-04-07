import type { Monitor, Notification } from "@openstatus/db/src/schema";

import type { Region } from "@openstatus/db/src/schema/constants";
import { PayloadSchema, WebhookSchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  cronTimestamp,
  statusCode,
  latency,
  message,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));


  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status:"error",
    statusCode,
    latency,
    errorMessage: message
  })



  try {
    await fetch(notificationData.endpoint, {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        ...notificationData.headers,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  cronTimestamp,
  latency,
  statusCode,
  message,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));


  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status:"recovered",
    statusCode,
    latency,
    errorMessage: message
  })
  const url = notificationData.endpoint;
  try {
    await fetch(url, {
      method: "post",
      body:JSON.stringify(body),
      headers: {
        ...notificationData.headers,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  cronTimestamp,
  latency,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));


  const body = PayloadSchema.parse({
    monitior: monitor,
    cronTimestamp,
    status:"degraded",
    statusCode,
    latency,
    errorMessage: message
  })

  try {
    await fetch(notificationData.endpoint, {
      method: "post",
      body:JSON.stringify(body),
      headers: {
        ...notificationData.headers,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendTest = async ({
   url,
  headers,
}: {
  url: string;
  headers?: Record<string, string>;
}) => {

  const body = PayloadSchema.parse({
    monitor: {
      id:1,
      name:"test",
      url:"http://openstat.us",
    },
    cronTimestamp: Date.now(),
    status:"recovered",
    statusCode: 200,
    latency: 1337,
  })
  try {
    await fetch(url, {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        ...headers,
      },
    });
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};
