import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("PagerDuty Notifications", () => {
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

  const createMockIncident = () => ({
    id: 1,
    title: "API Health Check is down",
    summary: "API Health Check is down",
    status: "triage" as const,
    monitorId: "monitor-1",
    workspaceId: 1,
    startedAt: Date.now(),
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
    const incident = createMockIncident();

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      // @ts-expect-error
      incident,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://events.pagerduty.com/v2/enqueue");
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.routing_key).toBe("my_key");
    expect(body.dedup_key).toBe("monitor-1");
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
    const incident = createMockIncident();

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 500,
      message: "Error",
      // @ts-expect-error
      incident,
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 2);
    expect(fetchMock.calls[0].args[1].body).toContain("key1");
    expect(fetchMock.calls[1].args[1].body).toContain("key2");
  });

  test("Send Degraded", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );
    const incident = createMockIncident();

    await sendDegraded({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 503,
      message: "Service degraded",
      // @ts-expect-error
      incident,
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body.payload.summary).toBe("API Health Check is degraded");
    expect(body.payload.severity).toBe("warning");
    expect(body.dedup_key).toBe("monitor-1");
  });

  test("Send Recovery", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );
    const incident = createMockIncident();

    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 200,
      message: "Service recovered",
      // @ts-expect-error
      incident,
      cronTimestamp: Date.now(),
    });

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe("https://events.pagerduty.com/v2/enqueue");
    const body = JSON.parse(callArgs[1].body);
    expect(body.routing_key).toBe("my_key");
    expect(body.dedup_key).toBe("monitor-1");
    expect(body.event_action).toBe("resolve");
  });

  test("Send Test", async () => {
    const result = await sendTest({
      integrationKey: "test-integration-key",
    });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
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
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTest({
      integrationKey: "test-key",
    });

    expect(result).toBe(false);
    assertSpyCalls(fetchMock, 1);
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
    const incident = createMockIncident();

    expect(
      sendAlert({
        // @ts-expect-error
        monitor,
        notification,
        statusCode: 500,
        message: "Error",
        // @ts-expect-error
        incident,
        cronTimestamp: Date.now(),
      }),
    ).rejects.toThrow();

    assertSpyCalls(fetchMock, 1);
  });
});
