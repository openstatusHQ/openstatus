import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { OpsGeniePayloadAlert, OpsGenieSchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  incidentId,
  cronTimestamp,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}}-${incidentId}`,
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

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}}-${incidentId}`,
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

    // Do something
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  statusCode,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  message,
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const { opsgenie } = OpsGenieSchema.parse(JSON.parse(notification.data));

  const url =
    opsgenie.region === "eu"
      ? `https://api.eu.opsgenie.com/v2/alerts/${monitor.id}}-${incidentId}/close`
      : `https://api.opsgenie.com/v2/alerts/${monitor.id}}-${incidentId}/close`;

  const event = OpsGeniePayloadAlert.parse({
    alias: `${monitor.id}}-${incidentId}`,
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
