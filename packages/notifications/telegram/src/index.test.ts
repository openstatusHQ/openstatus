import { selectNotificationSchema } from "@openstatus/db/src/schema";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import {
  sendAlert,
  sendDegraded,
  sendMessage,
  sendRecovery,
  sendTest,
} from "./index";

describe("Telegram Notifications", () => {
  let fetchMock: MockInstance;
  const originalEnv = process.env.TELEGRAM_BOT_TOKEN;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token-123";
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 200 })),
      );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    if (originalEnv) {
      process.env.TELEGRAM_BOT_TOKEN = originalEnv;
    } else {
      delete process.env.TELEGRAM_BOT_TOKEN;
    }
  });

  describe("sendMessage", () => {
    test("preserves message text without adding query parameters", async () => {
      const message =
        "API A+B #1 / https://example.com/?a=1&b=2\nError: café 50% %26 &chat_id=other";

      await sendMessage({ chatId: "-123456789", message });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = new URL(new Request(fetchMock.mock.calls[0][0]).url);
      expect([...url.searchParams]).toEqual([
        ["chat_id", "-123456789"],
        ["text", message],
      ]);
    });
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
    name: "Telegram Notification",
    provider: "telegram",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: JSON.stringify({
      telegram: {
        chatId: "123456789",
      },
    }),
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
    expect(callArgs[0]).toContain(
      "https://api.telegram.org/bottest-bot-token-123/sendMessage",
    );
    expect(callArgs[0]).toContain("chat_id=123456789");
    const text = new URL(new Request(callArgs[0]).url).searchParams.get("text");
    expect(text).toContain(monitor.name);
    expect(text).toContain(monitor.url);
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
    const text = new URL(new Request(callArgs[0]).url).searchParams.get("text");
    expect(text).toContain("Connection timeout");
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
    const text = new URL(new Request(callArgs[0]).url).searchParams.get("text");
    expect(text).toContain(monitor.name);
    expect(text).toContain(monitor.url);
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
    const text = new URL(new Request(callArgs[0]).url).searchParams.get("text");
    expect(text).toContain(monitor.name);
    expect(text).toContain(monitor.url);
  });

  test("Send Test", async () => {
    const result = await sendTest({
      chatId: "123456789",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toContain(
      "https://api.telegram.org/bottest-bot-token-123/sendMessage",
    );
    expect(callArgs[0]).toContain("chat_id=123456789");
  });

  test("Send Test returns false on error", async () => {
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("Network error")));

    const result = await sendTest({
      chatId: "123456789",
    });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Handle fetch error gracefully", async () => {
    fetchMock.mockRestore();
    fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.reject(new Error("Network error")));

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

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("fetch not called when TELEGRAM_BOT_TOKEN is not set", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

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
    // Should not call fetch when token is missing
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
