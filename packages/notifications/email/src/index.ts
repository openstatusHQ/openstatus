import {
  type Monitor,
  type Notification,
  emailDataSchema,
} from "@openstatus/db/src/schema";

import type { Region } from "@openstatus/db/src/schema/constants";
import { EmailClient } from "@openstatus/emails/src/client";
import { flyRegionsDict } from "@openstatus/utils";
import { env } from "../env";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  cronTimestamp,
  latency,
  region,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  region?: Region;
  latency?: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  await emailClient.sendMonitorAlert({
    name: monitor.name,
    type: "alert",
    to: config.data.email,
    url: monitor.url,
    status: statusCode?.toString(),
    latency: latency ? `${latency}ms` : "N/A",
    region: region ? flyRegionsDict[region].location : "N/A",
    timestamp: new Date(cronTimestamp).toISOString(),
    message,
  });
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  cronTimestamp,
  region,
  latency,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  region?: Region;
  latency?: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  await emailClient.sendMonitorAlert({
    name: monitor.name,
    type: "recovery",
    to: config.data.email,
    url: monitor.url,
    status: statusCode?.toString(),
    latency: latency ? `${latency}ms` : "N/A",
    region: region ?? "N/A",
    timestamp: new Date(cronTimestamp).toISOString(),
  });
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  cronTimestamp,
  region,
  latency,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  cronTimestamp: number;
  region?: Region;
  latency?: number;
}) => {
  const config = emailDataSchema.safeParse(JSON.parse(notification.data));

  if (!config.success) return;

  await emailClient.sendMonitorAlert({
    name: monitor.name,
    type: "degraded",
    to: config.data.email,
    url: monitor.url,
    status: statusCode?.toString(),
    latency: latency ? `${latency}ms` : "N/A",
    region: region ?? "N/A",
    timestamp: new Date(cronTimestamp).toISOString(),
  });
};
