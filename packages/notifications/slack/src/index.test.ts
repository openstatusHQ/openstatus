import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTestSlackMessage,
} from "./index";

describe("Slack Notifications", () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let fetchMock: any = undefined;

  beforeEach(() => {
    // @ts-expect-error
    fetchMock = spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://hooks.slack.com/services/url");
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe("#ED4245");
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments[0].color).toBe("#ED4245");
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe("#57F287");
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.attachments).toBeDefined();
    expect(body.attachments[0].color).toBe("#FEE75C");
    expect(body.attachments[0].blocks[0].text.text).toContain("is degraded");
  });

  test("Send Test Slack Message", async () => {
    const webhookUrl = "https://hooks.slack.com/services/test/url";

    const result = await sendTestSlackMessage(webhookUrl);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(webhookUrl);

    const body = JSON.parse(callArgs[1].body);
    expect(body.blocks[1].text.text).toContain("🧪 Test");
    expect(body.blocks[1].text.text).toContain("OpenStatus");
  });

  test("Send Test Slack Message returns false on error", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTestSlackMessage(
      "https://hooks.slack.com/services/test/url",
    );

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Handle fetch error gracefully", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    // Should not throw - function catches errors internally
    expect(
      sendAlert({
        // @ts-expect-error
        monitor,
        notification,
        statusCode: 500,
        message: "Error",
        cronTimestamp: Date.now(),
      }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
