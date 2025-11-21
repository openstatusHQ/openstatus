import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  spyOn,
  test,
} from "bun:test";
import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { sendAlert, sendDegraded, sendRecovery } from "./index";

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
    jest.resetAllMocks();
  });

  test("Send degraded", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };

    const a = {
      id: 1,
      name: "slack Notification",
      provider: "slack",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"slack":"https://hooks.slack.com/services/url"}',
    };

    const n = selectNotificationSchema.parse(a);
    await sendDegraded({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  test("Send Recovered", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };

    const a = {
      id: 1,
      name: "slack Notification",
      provider: "slack",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"slack":"https://hooks.slack.com/services/url"}',
    };

    const n = selectNotificationSchema.parse(a);
    await sendRecovery({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  test("Send Alert", async () => {
    const monitor = {
      id: "monitor-1",
      name: "API Health Check",
      url: "https://api.example.com/health",
      jobType: "http" as const,
      periodicity: "5m" as const,
      status: "active" as const, // or "down", "degraded"
      createdAt: new Date(),
      updatedAt: new Date(),
      region: "us-east-1",
    };
    const a = {
      id: 1,
      name: "slack Notification",
      provider: "slack",
      workspaceId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: '{"slack":"https://hooks.slack.com/services/url"}',
    };

    const n = selectNotificationSchema.parse(a);

    await sendAlert({
      // @ts-expect-error
      monitor,
      notification: n,
      statusCode: 500,
      message: "Something went wrong",
      cronTimestamp: Date.now(),
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
