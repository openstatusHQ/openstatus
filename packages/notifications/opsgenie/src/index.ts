import type { NotificationContext } from "@openstatus/notification-base";
import { OpsGeniePayloadAlert, OpsGenieSchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
}: NotificationContext) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}-${incident?.id}`,
    message: `${name} is down`,
    description: message,
    details: {
      message,
      status: statusCode,
      severity: "down",
    },
  });

  const url =
    opsgenie.region === "eu"
      ? "https://api.eu.opsgenie.com/v2/alerts"
      : "https://api.opsgenie.com/v2/alerts";

  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
      Authorization: `GenieKey ${opsgenie.apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to send OpsGenie alert: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
}: NotificationContext) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}-${incident?.id}`,
    message: `${name} is down`,
    description: message,
    details: {
      message,
      status: statusCode,
      severity: "degraded",
    },
  });

  const url =
    opsgenie.region === "eu"
      ? "https://api.eu.opsgenie.com/v2/alerts"
      : "https://api.opsgenie.com/v2/alerts";
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
      Authorization: `GenieKey ${opsgenie.apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to send OpsGenie degraded alert: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
}: NotificationContext) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));

  const url =
    opsgenie.region === "eu"
      ? `https://api.eu.opsgenie.com/v2/alerts/${monitor.id}}-${incident?.id}/close`
      : `https://api.opsgenie.com/v2/alerts/${monitor.id}}-${incident?.id}/close`;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}-${incident?.id}`,
    message: `${monitor.name} has recovered`,
    description: message,
    details: {
      message,
      status: statusCode,
    },
  });
  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(event),
      headers: {
        "Content-Type": "application/json",
        Authorization: `GenieKey ${opsgenie.apiKey}`,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};
export const sendTest = async (props: {
  apiKey: string;
  region: "eu" | "us";
}) => {
  const { apiKey, region } = props;

  const url =
    region === "eu"
      ? "https://api.eu.opsgenie.com/v2/alerts"
      : "https://api.opsgenie.com/v2/alerts";

  const alert = OpsGeniePayloadAlert.parse({
    alias: "test-openstatus",
    message: "Test Alert <OpenStatus>",
    description:
      "If you can read this, your OpsGenie integration is functioning correctly! Please ignore this alert and delete it.",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(alert),
      headers: {
        "Content-Type": "application/json",
        Authorization: `GenieKey ${apiKey}`,
        "Access-Control-Allow-Origin": "*",
      },
    });
    console.log(await res.json());
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

export { OpsGenieSchema };
