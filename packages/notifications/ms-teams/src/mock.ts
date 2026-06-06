import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

function requireWebhookUrl(): string {
  const url = process.env.MS_TEAMS_WEBHOOK;
  if (!url) {
    throw new Error("MS_TEAMS_WEBHOOK env var is required");
  }
  return url;
}

const webhookUrl = requireWebhookUrl();

const monitor: Monitor = {
  id: 1,
  name: "OpenStatus Docs",
  url: "https://www.openstatus.dev/docs",
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
  externalName: null,
  otelEndpoint: null,
  otelHeaders: [],
  retry: 3,
  followRedirects: false,
};

const notification: Notification = {
  id: 1,
  name: "Microsoft Teams",
  data: JSON.stringify({ "ms-teams": { webhookUrl } }),
  provider: "ms-teams",
  workspaceId: 1,
  createdAt: null,
  updatedAt: null,
};

async function main() {
  console.log("Sending alert...");
  await sendAlert({
    monitor,
    notification,
    statusCode: 503,
    message: "Connection timeout",
    cronTimestamp: Date.now(),
    latency: 2450,
    regions: ["ams"],
  });

  console.log("Sending degraded...");
  await sendDegraded({
    monitor,
    notification,
    statusCode: 504,
    message: "Slow response",
    cronTimestamp: Date.now(),
    latency: 5234,
    regions: ["ams"],
  });

  console.log("Sending recovery...");
  await sendRecovery({
    monitor,
    notification,
    statusCode: 200,
    cronTimestamp: Date.now(),
    latency: 156,
    regions: ["ams"],
  });

  console.log("Sending test...");
  await sendTest({ webhookUrl });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
