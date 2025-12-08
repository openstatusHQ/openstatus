import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTestDiscordMessage,
} from "./index";

describe("Discord Notifications", () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let fetchMock: any = undefined;

  beforeEach(() => {
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
    region: "iad",
  });

  const createMockNotification = () => ({
    id: 1,
    name: "Discord Notification",
    provider: "discord",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"discord":"https://discord.com/api/webhooks/123456789/abcdefgh"}',
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
    expect(callArgs[0]).toBe(
      "https://discord.com/api/webhooks/123456789/abcdefgh",
    );
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(callArgs[1].body);
    expect(body.content).toContain("🚨 Alert");
    expect(body.content).toContain("API Health Check");
    expect(body.content).toContain("Something went wrong");
    expect(body.username).toBe("OpenStatus Notifications");
    expect(body.avatar_url).toBeDefined();
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
    expect(body.content).toContain("✅ Recovered");
    expect(body.content).toContain("API Health Check");
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
    expect(body.content).toContain("⚠️ Degraded");
    expect(body.content).toContain("API Health Check");
  });

  test("Send Test Discord Message", async () => {
    const webhookUrl = "https://discord.com/api/webhooks/123456789/abcdefgh";

    const result = await sendTestDiscordMessage(webhookUrl);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(webhookUrl);
    const body = JSON.parse(callArgs[1].body);
    expect(body.content).toContain("🧪 Test");
    expect(body.content).toContain("OpenStatus");
  });

  test("Send Test Discord Message with empty webhookUrl", async () => {
    const result = await sendTestDiscordMessage("");

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
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
    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Error",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
