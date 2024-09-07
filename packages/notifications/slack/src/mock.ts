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
  jobType: "website",
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
  data: '{ "slack": "https://hooks.slack.com/services/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" }',
  createdAt: null,
  updatedAt: null,
  workspaceId: 1,
  provider: "slack",
};

if (process.env.NODE_ENV === "development") {
  await sendDegraded({
    monitor,
    notification,
  });

  await sendAlert({
    monitor,
    notification,
    statusCode: 500,
  });

  await sendRecovery({
    monitor,
    notification,
  });

  await sendTestSlackMessage(
    "https://hooks.slack.com/services/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"
  );
}
