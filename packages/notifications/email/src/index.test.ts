import {
  describe,
  mock,
  // jest,
  test,
} from "bun:test";

import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery } from "./index";

mock.module("@openstatus/emails/src/client", () => ({
  EmailClient: mock(() => ({
    sendMonitorAlert: mock(async () => {}),
  })),
}));

describe("Email Notifications", () => {
  test("Send degraded", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };

    const a = {
      id: 1,
      name: "email Notification",
      provider: "email",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"email":"ping@openstatus.dev"}',
    };

    const n = selectNotificationSchema.parse(a);
    await sendDegraded({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
  });

  test("Send Recovered", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };

    const a = {
      id: 1,
      name: "Email Notification",
      provider: "email",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"email":"ping@openstatus.dev"}',
    };

    const n = selectNotificationSchema.parse(a);
    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
  });

  test("Send Alert", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };
    const a = {
      id: 1,
      name: "PagerDuty Notification",
      provider: "email",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"email":"ping@openstatus.dev"}',
    };

    const n = selectNotificationSchema.parse(a);

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
  });
});
