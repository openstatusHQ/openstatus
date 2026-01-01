import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("Google Chat Notifications", () => {
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
    region: "iad",
  });

  const createMockNotification = () => ({
    id: 1,
    name: "Google Chat Notification",
    provider: "google-chat",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"google-chat":"https://google.com/api/webhooks/123456789/abcdefgh"}',
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
      "https://google.com/api/webhooks/123456789/abcdefgh",
    );
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(callArgs[1].body);
    console.log(body);
    expect(body.text).toContain("🚨 Alert");
    expect(body.text).toContain("API Health Check");
    expect(body.text).toContain("Something went wrong");
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
    expect(body.text).toContain("✅ Recovered");
    expect(body.text).toContain("API Health Check");
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
    expect(body.text).toContain("⚠️ Degraded");
    expect(body.text).toContain("API Health Check");
  });

  test("Send Test Google Chat Message", async () => {
    const webhookUrl = "https://google.com/api/webhooks/123456789/abcdefgh";

    const result = await sendTest(webhookUrl);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(webhookUrl);
    const body = JSON.parse(callArgs[1].body);
    expect(body.text).toContain("🧪 Test");
    expect(body.text).toContain("OpenStatus");
  });

  test("Send Test Google Chat Message with empty webhookUrl", async () => {
    const result = await sendTest("");

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
  });
});
