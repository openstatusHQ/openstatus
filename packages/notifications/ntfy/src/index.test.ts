import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("Ntfy Notifications", () => {
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

  const createMockNotification = (withToken = false, withServerUrl = false) => {
    const data: {
      ntfy: { topic: string; token?: string; serverUrl?: string };
    } = {
      ntfy: {
        topic: "my-topic",
      },
    };
    if (withToken) {
      data.ntfy.token = "test-token-123";
    }
    if (withServerUrl) {
      data.ntfy.serverUrl = "https://ntfy.example.com";
    }
    return {
      id: 1,
      name: "Ntfy Notification",
      provider: "ntfy",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: JSON.stringify(data),
    };
  };

  test("Send Alert with default server", async () => {
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
    expect(callArgs[0]).toBe("https://ntfy.sh/my-topic");
    expect(callArgs[1].method).toBe("post");
    expect(callArgs[1].body).toContain("API Health Check");
    expect(callArgs[1].body).toContain("status code 500");
    expect(callArgs[1].headers).not.toHaveProperty("Authorization");
  });

  test("Send Alert with custom server", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(false, true),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Error",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://ntfy.example.com/my-topic");
  });

  test("Send Alert with token", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(true),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Error",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].headers.Authorization).toBe("Bearer test-token-123");
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
    expect(callArgs[1].body).toContain("error: Connection timeout");
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
    expect(callArgs[1].body).toContain("is up again");
  });

  test("Send Recovery with token", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(true),
    );

    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification,
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].headers.Authorization).toBe("Bearer test-token-123");
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
    expect(callArgs[1].body).toContain("is degraded");
  });

  test("Send Test with default server", async () => {
    const result = await sendTest({
      topic: "test-topic",
    });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://ntfy.sh/test-topic");
    expect(callArgs[1].body).toBe("This is a test message from OpenStatus");
    expect(callArgs[1].headers).not.toHaveProperty("Authorization");
  });

  test("Send Test with custom server", async () => {
    const result = await sendTest({
      topic: "test-topic",
      serverUrl: "https://ntfy.example.com",
    });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://ntfy.example.com/test-topic");
  });

  test("Send Test with token", async () => {
    const result = await sendTest({
      topic: "test-topic",
      token: "test-token",
    });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[1].headers.Authorization).toBe("Bearer test-token");
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

    // Should not throw - function catches errors internally
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

  test("Send Test returns false on error", async () => {
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTest({
      topic: "test-topic",
    });

    expect(result).toBe(false);
    assertSpyCalls(fetchMock, 1);
  });
});
