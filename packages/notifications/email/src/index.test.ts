import "./test-preload.ts";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails/src/client";
import {
  afterEach,
  assertSpyCalls,
  beforeEach,
  describe,
  expect,
  type Stub,
  stub,
  test,
} from "@openstatus/test-utils";

import { sendAlert, sendDegraded, sendRecovery } from "./index";

// biome-ignore lint/suspicious/noExplicitAny: stub over the EmailClient method
let sendMonitorAlertMock: Stub<any>;

describe("Email Notifications", () => {
  beforeEach(() => {
    sendMonitorAlertMock = stub(EmailClient.prototype, "sendMonitorAlert", () =>
      Promise.resolve(),
    );
  });

  afterEach(() => {
    sendMonitorAlertMock.restore();
  });

  const createMockMonitor = () => ({
    id: "monitor-1",
    name: "API Health Check",
    url: "https://api.example.com/health",
    jobType: "http" as const,
    periodicity: "5m" as const,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    region: "iad",
  });

  const createMockNotification = () => ({
    id: 1,
    name: "Email Notification",
    provider: "email",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"email":"ping@openstatus.dev"}',
  });

  test("Send Alert", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Something went wrong",
      latency: 1500,
      regions: ["iad"],
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(sendMonitorAlertMock, 1);
    const callArgs = sendMonitorAlertMock.calls[0].args[0];
    expect(callArgs.name).toBe("API Health Check");
    expect(callArgs.type).toBe("alert");
    expect(callArgs.to).toBe("ping@openstatus.dev");
    expect(callArgs.url).toBe("https://api.example.com/health");
    expect(callArgs.status).toBe("500");
    expect(callArgs.latency).toBe("1500ms");
    expect(callArgs.region).toBe("Ashburn, Virginia, USA");
    expect(callArgs.message).toBe("Something went wrong");
    expect(callArgs.timestamp).toBeDefined();
  });

  test("Send Alert without optional fields", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(sendMonitorAlertMock, 1);
    const callArgs = sendMonitorAlertMock.calls[0].args[0];
    expect(callArgs.status).toBeUndefined();
    expect(callArgs.latency).toBe("N/A");
    expect(callArgs.region).toBe("N/A");
  });

  test("Send Recovery", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 200,
      latency: 100,
      regions: ["ams"],
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(sendMonitorAlertMock, 1);
    const callArgs = sendMonitorAlertMock.calls[0].args[0];
    expect(callArgs.type).toBe("recovery");
    expect(callArgs.name).toBe("API Health Check");
    expect(callArgs.to).toBe("ping@openstatus.dev");
    expect(callArgs.status).toBe("200");
    expect(callArgs.latency).toBe("100ms");
    expect(callArgs.region).toBe("Amsterdam, Netherlands");
  });

  test("Send Degraded", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendDegraded({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 503,
      latency: 2000,
      regions: ["lax"],
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(sendMonitorAlertMock, 1);
    const callArgs = sendMonitorAlertMock.calls[0].args[0];
    expect(callArgs.type).toBe("degraded");
    expect(callArgs.name).toBe("API Health Check");
    expect(callArgs.status).toBe("503");
    expect(callArgs.latency).toBe("2000ms");
    expect(callArgs.region).toBe("Los Angeles, California, USA");
  });

  test("Handles invalid notification data gracefully", async () => {
    const monitor = createMockMonitor();
    const invalidNotification = selectNotificationSchema.parse({
      id: 1,
      name: "Email Notification",
      provider: "email",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"invalid":"data"}',
    });

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification: invalidNotification,
      cronTimestamp: Date.now(),
    });

    // Should not call sendMonitorAlert when data is invalid
    assertSpyCalls(sendMonitorAlertMock, 0);
  });
});
