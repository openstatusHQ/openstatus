import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, stub, type Stub } from "@std/testing/mock";

import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("Novu Notifications", () => {
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

  const createMockNotification = (region: "eu" | "us" = "us") =>
    selectNotificationSchema.parse({
      id: 1,
      name: "Novu Notification",
      provider: "novu",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: JSON.stringify({
        novu: {
          apiKey: "test-secret-key",
          workflowId: "monitor-alert",
          subscriberId: "sub-123",
          region,
        },
      }),
    });

  test("Send Alert triggers workflow on US region", async () => {
    await sendAlert({
      // @ts-expect-error partial monitor mock
      monitor: createMockMonitor(),
      notification: createMockNotification("us"),
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: 1700000000000,
    });

    assertSpyCalls(fetchMock, 1);
    const [url, init] = fetchMock.calls[0].args;
    expect(url).toBe("https://api.novu.co/v1/events/trigger");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("ApiKey test-secret-key");
    expect(init.headers["Idempotency-Key"]).toBe(
      "monitor-1-1700000000000-alert",
    );

    const body = JSON.parse(init.body);
    expect(body.name).toBe("monitor-alert");
    expect(body.to.subscriberId).toBe("sub-123");
    expect(body.payload.type).toBe("alert");
    expect(body.payload.status).toBe("down");
    expect(body.payload.monitorName).toBe("API Health Check");
    expect(body.payload.statusCode).toBe(500);
    expect(body.payload.message).toBe("Something went wrong");
  });

  test("Send Alert targets the EU trigger endpoint", async () => {
    await sendAlert({
      // @ts-expect-error partial monitor mock
      monitor: createMockMonitor(),
      notification: createMockNotification("eu"),
      statusCode: 500,
      message: "Error",
      cronTimestamp: 1700000000000,
    });

    const [url] = fetchMock.calls[0].args;
    expect(url).toBe("https://eu.api.novu.co/v1/events/trigger");
  });

  test("Send Degraded sets degraded status", async () => {
    await sendDegraded({
      // @ts-expect-error partial monitor mock
      monitor: createMockMonitor(),
      notification: createMockNotification(),
      statusCode: 503,
      message: "Service degraded",
      cronTimestamp: 1700000000000,
    });

    const body = JSON.parse(fetchMock.calls[0].args[1].body);
    expect(body.payload.type).toBe("degraded");
    expect(body.payload.status).toBe("degraded");
  });

  test("Send Recovery sets recovered status", async () => {
    await sendRecovery({
      // @ts-expect-error partial monitor mock
      monitor: createMockMonitor(),
      notification: createMockNotification(),
      cronTimestamp: 1700000000000,
    });

    const body = JSON.parse(fetchMock.calls[0].args[1].body);
    expect(body.payload.type).toBe("recovery");
    expect(body.payload.status).toBe("recovered");
  });

  test("Send Alert throws on non-ok response", async () => {
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response(null, { status: 401 })),
    );

    await expect(
      sendAlert({
        // @ts-expect-error partial monitor mock
        monitor: createMockMonitor(),
        notification: createMockNotification(),
        statusCode: 500,
        message: "Error",
        cronTimestamp: 1700000000000,
      }),
    ).rejects.toThrow();
    assertSpyCalls(fetchMock, 1);
  });

  test("Send Test returns true on success", async () => {
    const result = await sendTest({
      apiKey: "test-secret-key",
      workflowId: "monitor-alert",
      subscriberId: "sub-123",
      region: "us",
    });

    expect(result).toBe(true);
    assertSpyCalls(fetchMock, 1);
    const [url, init] = fetchMock.calls[0].args;
    expect(url).toBe("https://api.novu.co/v1/events/trigger");
    expect(init.headers.Authorization).toBe("ApiKey test-secret-key");
    const body = JSON.parse(init.body);
    expect(body.name).toBe("monitor-alert");
    expect(body.to.subscriberId).toBe("sub-123");
    expect(body.payload.type).toBe("test");
  });

  test("Send Test returns false on error", async () => {
    fetchMock.restore();
    fetchMock = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTest({
      apiKey: "test-secret-key",
      workflowId: "monitor-alert",
      subscriberId: "sub-123",
      region: "us",
    });

    expect(result).toBe(false);
    assertSpyCalls(fetchMock, 1);
  });
});
