import type { NotificationContext } from "@openstatus/notification-base";
import { GrafanaOncallPayload, GrafanaOncallSchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
}: NotificationContext) => {
  const { "grafana-oncall": config } = GrafanaOncallSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const event = GrafanaOncallPayload.parse({
    alert_uid: `openstatus-monitor-${monitor.id}`,
    title: `${name} is down`,
    message: message || `Status code: ${statusCode}`,
    state: "alerting",
    link_to_upstream_details: `https://www.openstatus.dev/app/${monitor.id}/overview`,
  });

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to send Grafana OnCall alert: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
}: NotificationContext) => {
  const { "grafana-oncall": config } = GrafanaOncallSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const event = GrafanaOncallPayload.parse({
    alert_uid: `openstatus-monitor-${monitor.id}`,
    title: `${name} is degraded`,
    message: message || `Status code: ${statusCode}`,
    state: "alerting",
    link_to_upstream_details: `https://www.openstatus.dev/app/${monitor.id}/overview`,
  });

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to send Grafana OnCall degraded alert: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
}: NotificationContext) => {
  const { "grafana-oncall": config } = GrafanaOncallSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const event = GrafanaOncallPayload.parse({
    alert_uid: `openstatus-monitor-${monitor.id}`,
    title: `${name} has recovered`,
    message: message || `Status code: ${statusCode}`,
    state: "ok",
    link_to_upstream_details: `https://www.openstatus.dev/app/${monitor.id}/overview`,
  });

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to send Grafana OnCall recovery: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendTest = async (props: { webhookUrl: string }) => {
  const { webhookUrl } = props;

  const event = GrafanaOncallPayload.parse({
    alert_uid: "openstatus-test",
    title: "Test Alert <OpenStatus>",
    message:
      "If you can read this, your Grafana OnCall integration is functioning correctly! Please ignore this alert.",
    state: "alerting",
    link_to_upstream_details: "https://www.openstatus.dev",
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      body: JSON.stringify(event),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to send test: ${res.status} ${res.statusText}`);
    }

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
};

export { GrafanaOncallSchema };
