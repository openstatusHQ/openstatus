import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery } from "./index";

describe("Twilio SMS Notifications", () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let fetchMock: any = undefined;
  const originalEnv = {
    TWILLIO_ACCOUNT_ID: process.env.TWILLIO_ACCOUNT_ID,
    TWILLIO_AUTH_TOKEN: process.env.TWILLIO_AUTH_TOKEN,
  };

  beforeEach(() => {
    process.env.TWILLIO_ACCOUNT_ID = "test-account-id";
    process.env.TWILLIO_AUTH_TOKEN = "test-auth-token";
    fetchMock = spyOn(global, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    if (fetchMock) {
      fetchMock.mockRestore();
    }
    if (originalEnv.TWILLIO_ACCOUNT_ID) {
      process.env.TWILLIO_ACCOUNT_ID = originalEnv.TWILLIO_ACCOUNT_ID;
    } else {
      process.env.TWILLIO_ACCOUNT_ID = undefined;
    }
    if (originalEnv.TWILLIO_AUTH_TOKEN) {
      process.env.TWILLIO_AUTH_TOKEN = originalEnv.TWILLIO_AUTH_TOKEN;
    } else {
      process.env.TWILLIO_AUTH_TOKEN = undefined;
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
    name: "Twilio SMS Notification",
    provider: "sms",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"sms":"+33623456789"}',
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
      "https://api.twilio.com/2010-04-01/Accounts/test-account-id/Messages.json",
    );
    expect(callArgs[1].method).toBe("post");
    expect(callArgs[1].headers.Authorization).toBe(
      `Basic ${btoa("test-account-id:test-auth-token")}`,
    );

    const formData = callArgs[1].body as FormData;
    expect(formData.get("To")).toBe("+33623456789");
    expect(formData.get("From")).toBe("+14807252613");
    expect(formData.get("Body")).toContain("API Health Check");
    expect(formData.get("Body")).toContain("status code 500");
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
    const formData = callArgs[1].body as FormData;
    expect(formData.get("Body")).toContain("error: Connection timeout");
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
    const formData = callArgs[1].body as FormData;
    expect(formData.get("Body")).toContain("is up again");
    expect(formData.get("Body")).toContain("API Health Check");
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
    const formData = callArgs[1].body as FormData;
    expect(formData.get("Body")).toContain("is degraded");
    expect(formData.get("Body")).toContain("API Health Check");
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
