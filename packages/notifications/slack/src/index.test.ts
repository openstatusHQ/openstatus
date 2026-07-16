import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { COLORS } from "@openstatus/notification-base";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import {
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTestSlackMessage,
} from "./index";

describe("Slack Notifications", () => {
  let fetchMock: Stub<typeof globalThis>;

  beforeEach(() => {
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    fetchMock.restore();
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
    region: "us-east-1",
  });

  const createMockNotification = () => ({
    id: 1,
    name: "Slack Notification",
    provider: "slack",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"slack":"https://hooks.slack.com/services/url"}',
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
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://hooks.slack.com/services/url");
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe(COLORS.red);
    expect(body.attachments[0].blocks).toBeDefined();
    expect(body.attachments[0].blocks.length).toBeGreaterThan(0);
    expect(body.attachments[0].blocks[0].text.text).toContain("is failing");
  });

  test("Send Alert without statusCode", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      message: "Connection timeout",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments[0].color).toBe(COLORS.red);
    expect(body.attachments[0].blocks[3].fields[0].text).toContain("Unknown");
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
      message: "Service recovered",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe(COLORS.green);
    expect(body.attachments[0].blocks[0].text.text).toContain("is recovered");
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
      message: "Service degraded",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe(COLORS.yellow);
    expect(body.attachments[0].blocks[0].text.text).toContain("is degraded");
  });

  test("Send Test Slack Message", async () => {
    const webhookUrl = "https://hooks.slack.com/services/test/url";

    await sendTestSlackMessage(webhookUrl);

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe(webhookUrl);

    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments[0].blocks[0].text.text).toContain(
      "Test Notification",
    );
  });

  test("Send Test Slack Message throws error on empty webhookUrl", async () => {
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error")),
    );

    expect(sendTestSlackMessage("")).rejects.toThrow();
    assertSpyCalls(fetchMock, 0);
  });

  test("Handle fetch error gracefully", async () => {
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error")),
    );

    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await expect(
      sendAlert({
        // @ts-expect-error
        monitor,
        notification,
        statusCode: 500,
        message: "Error",
        cronTimestamp: Date.now(),
      }),
    ).rejects.toThrow();

    assertSpyCalls(fetchMock, 1);
  });
});
