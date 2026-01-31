import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery, sendTest } from "./index";

describe("Grafana OnCall Notifications", () => {
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
    name: "Grafana OnCall Notification",
    provider: "grafana-oncall",
    workspaceId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    data: '{"grafana-oncall":{"webhookUrl":"https://oncall.example.com/integrations/v1/webhook/abc123"}}',
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
      "https://oncall.example.com/integrations/v1/webhook/abc123",
    );
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(callArgs[1].body);
    expect(body.alert_uid).toBe("openstatus-monitor-monitor-1");
    expect(body.title).toBe("API Health Check is down");
    expect(body.message).toBe("Something went wrong");
    expect(body.state).toBe("alerting");
    expect(body.link_to_upstream_details).toBe(
      "https://www.openstatus.dev/app/monitor-1/overview",
    );
  });

  test("Send Alert uses status code as message when no message provided", async () => {
    const monitor = createMockMonitor();
    const notification = selectNotificationSchema.parse(
      createMockNotification(),
    );

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification,
      statusCode: 503,
      cronTimestamp: Date.now(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.message).toBe("Status code: 503");
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
    expect(callArgs[0]).toBe(
      "https://oncall.example.com/integrations/v1/webhook/abc123",
    );

    const body = JSON.parse(callArgs[1].body);
    expect(body.alert_uid).toBe("openstatus-monitor-monitor-1");
    expect(body.title).toBe("API Health Check is degraded");
    expect(body.message).toBe("Service degraded");
    expect(body.state).toBe("alerting");
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
    expect(callArgs[0]).toBe(
      "https://oncall.example.com/integrations/v1/webhook/abc123",
    );

    const body = JSON.parse(callArgs[1].body);
    expect(body.alert_uid).toBe("openstatus-monitor-monitor-1");
    expect(body.title).toBe("API Health Check has recovered");
    expect(body.message).toBe("Service recovered");
    expect(body.state).toBe("ok");
  });

  test("Send Test", async () => {
    const webhookUrl =
      "https://oncall.example.com/integrations/v1/webhook/test123";

    const result = await sendTest({ webhookUrl });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe(webhookUrl);
    expect(callArgs[1].method).toBe("POST");

    const body = JSON.parse(callArgs[1].body);
    expect(body.alert_uid).toBe("openstatus-test");
    expect(body.title).toBe("Test Alert <OpenStatus>");
    expect(body.message).toContain("Grafana OnCall integration is functioning");
    expect(body.state).toBe("alerting");
    expect(body.link_to_upstream_details).toBe("https://www.openstatus.dev");
  });

  test("Send Test returns false on network error", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    const result = await sendTest({
      webhookUrl: "https://oncall.example.com/integrations/v1/webhook/test123",
    });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Send Test returns false on non-ok response", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 401 })),
    );

    const result = await sendTest({
      webhookUrl: "https://oncall.example.com/integrations/v1/webhook/test123",
    });

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("Send Alert throws on non-ok response", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 500, statusText: "Internal Server Error" })),
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
    ).rejects.toThrow("Failed to send Grafana OnCall alert");
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
