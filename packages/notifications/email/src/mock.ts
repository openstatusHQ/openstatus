import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery } from "./index";

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
  name: "Email",
  data: '{ "email": "max@openstatus.dev" }',
  createdAt: null,
  updatedAt: null,
  workspaceId: 1,
  provider: "email",
};

if (process.env.NODE_ENV === "development") {
  sendDegraded({
    monitor,
    notification,
  });

  sendAlert({
    monitor,
    notification,
    statusCode: 500,
  });

  sendRecovery({
    monitor,
    notification,
  });
}
