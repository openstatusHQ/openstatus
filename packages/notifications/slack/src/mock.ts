import type { Monitor, Notification } from "@openstatus/db/src/schema";
import {
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTestSlackMessage,
} from "./index";

const monitor: Monitor = {
  id: 1,
  name: "OpenStatus Docs",
  url: "https://docs.openstatus.dev",
  periodicity: "10m",
  jobType: "http",
  active: true,
  public: true,
  createdAt: null,
  updatedAt: null,
  regions: ["ams", "fra"],
  description: "Monitor Description",
  headers: [],
  body: "",
  workspaceId: 1,
  timeout: 45000,
  degradedAfter: null,
  assertions: null,
  status: "active",
  method: "GET",
  deletedAt: null,
};

const notification: Notification = {
  id: 1,
  name: "Slack",
  data: `{ "slack": "${process.env.SLACK_WEBHOOK}" }`,
  createdAt: null,
  updatedAt: null,
  workspaceId: 1,
  provider: "slack",
};

const cronTimestamp = Date.now();

if (process.env.NODE_ENV === "development") {
  await sendDegraded({
    monitor,
    notification,
    cronTimestamp,
  });

  await sendAlert({
    monitor,
    notification,
    statusCode: 500,
    cronTimestamp,
  });

  await sendRecovery({
    monitor,
    notification,
    cronTimestamp,
  });

  await sendTestSlackMessage(`${process.env.SLACK_WEBHOOK}`);
}
