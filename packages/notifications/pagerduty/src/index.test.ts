import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("PagerDuty Notifications", () => {
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
    name: "PagerDuty Notification",
    provider: "pagerduty",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"pagerduty":"{\\"integration_keys\\":[{\\"integration_key\\":\\"my_key\\",\\"name\\":\\"Default Service\\",\\"id\\":\\"ABCD\\",\\"type\\":\\"service\\"}],\\"account\\":{\\"subdomain\\":\\"test\\",\\"name\\":\\"test\\"}}"}',
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
      incidentId: "incident-123",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://events.pagerduty.com/v2/enqueue");
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.routing_key).toBe("my_key");
    expect(body.dedup_key).toBe("monitor-1}-incident-123");
    expect(body.event_action).toBe("trigger");
    expect(body.payload.summary).toBe("API Health Check is down");
    expect(body.payload.severity).toBe("error");
    expect(body.payload.custom_details.statusCode).toBe(500);
    expect(body.payload.custom_details.message).toBe("Something went wrong");
  });

  test("Send Alert with multiple integration keys", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse({
      id: 1,
      name: "PagerDuty Notification",
      provider: "pagerduty",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"pagerduty":"{\\"integration_keys\\":[{\\"integration_key\\":\\"key1\\",\\"name\\":\\"Service 1\\",\\"id\\":\\"ABCD\\",\\"type\\":\\"service\\"},{\\"integration_key\\":\\"key2\\",\\"name\\":\\"Service 2\\",\\"id\\":\\"EFGH\\",\\"type\\":\\"service\\"}],\\"account\\":{\\"subdomain\\":\\"test\\",\\"name\\":\\"test\\"}}"}',
    });

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Error",
      incidentId: "incident-456",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toContain("key1");
    expect(fetchMock.mock.calls[1][1].body).toContain("key2");
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
    expect(body.payload.summary).toBe("API Health Check is degraded");
    expect(body.payload.severity).toBe("warning");
    expect(body.dedup_key).toBe("monitor-1}");
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
      incidentId: "incident-123",
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://events.pagerduty.com/v2/enqueue");
    const body = JSON.parse(callArgs[1].body);
    expect(body.routing_key).toBe("my_key");
    expect(body.dedup_key).toBe("monitor-1}-incident-123");
    expect(body.event_action).toBe("resolve");
  });

  test("Send Test", async () => {
    const result = await sendTest({
      integrationKey: "test-integration-key",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("https://events.pagerduty.com/v2/enqueue");
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.routing_key).toBe("test-integration-key");
    expect(body.dedup_key).toBe("openstatus-test");
    expect(body.event_action).toBe("trigger");
    expect(body.payload.summary).toBe("This is a test from OpenStatus");
    expect(body.payload.severity).toBe("error");
    expect(body.payload.custom_details.statusCode).toBe(418);
  });

  test("Send Test returns false on error", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTest({
      integrationKey: "test-key",
    });

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
