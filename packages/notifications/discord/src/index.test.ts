import { selectNotificationSchema } from "@openstatus/db/src/schema";
import { COLOR_DECIMALS } from "@openstatus/notification-base";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";

import {
  sendAlert,
  sendDegraded,
  sendRecovery,
  sendTestDiscordMessage,
} from "./index";

const ok = (): Promise<Response> =>
  Promise.resolve(new Response(null, { status: 200 }));

describe("Discord Notifications", () => {
  let fetchMock: Stub<typeof globalThis>;

  beforeEach(() => {
    fetchMock = stub(globalThis, "fetch", ok);
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

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe(
      "https://discord.com/api/webhooks/123456789/abcdefgh",
    );
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(callArgs[1].body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain("is failing");
    expect(body.embeds[0].title).toContain("API Health Check");
    expect(body.embeds[0].color).toBe(COLOR_DECIMALS.red);
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

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    const body = JSON.parse(callArgs[1].body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain("is recovered");
    expect(body.embeds[0].title).toContain("API Health Check");
    expect(body.embeds[0].color).toBe(COLOR_DECIMALS.green);
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
    const body = JSON.parse(callArgs[1].body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain("is degraded");
    expect(body.embeds[0].title).toContain("API Health Check");
    expect(body.embeds[0].color).toBe(COLOR_DECIMALS.yellow); // Yellow color
  });

  test("Send Test Discord Message", async () => {
    const webhookUrl = "https://discord.com/api/webhooks/123456789/abcdefgh";
    await sendTestDiscordMessage(webhookUrl);

    assertSpyCalls(fetchMock, 1);
    const callArgs = fetchMock.calls[0].args;
    expect(callArgs[0]).toBe(webhookUrl);
    const body = JSON.parse(callArgs[1].body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain("Test Notification");
  });

  test("Send Test Discord Message with empty webhookUrl", async () => {
    expect(sendTestDiscordMessage("")).rejects.toThrow();
    assertSpyCalls(fetchMock, 0);
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
