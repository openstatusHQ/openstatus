import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  notification,
  notificationTrigger,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

// Mock audit log to avoid calling Tinybird
mock.module("../utils/audit-log", () => ({
  checkerAudit: {
    publishAuditLog: mock(() => Promise.resolve()),
  },
}));

// Mock notification providers to avoid real HTTP calls
const mockEmailSendAlert = mock(() => Promise.resolve());
const mockEmailSendRecovery = mock(() => Promise.resolve());
const mockEmailSendDegraded = mock(() => Promise.resolve());
const mockSlackSendAlert = mock(() => Promise.resolve());
const mockSlackSendRecovery = mock(() => Promise.resolve());
const mockSlackSendDegraded = mock(() => Promise.resolve());
const mockDiscordSendAlert = mock(() => Promise.resolve());
const mockDiscordSendRecovery = mock(() => Promise.resolve());
const mockDiscordSendDegraded = mock(() => Promise.resolve());

mock.module("./utils", () => ({
  providerToFunction: {
    email: {
      sendAlert: mockEmailSendAlert,
      sendRecovery: mockEmailSendRecovery,
      sendDegraded: mockEmailSendDegraded,
    },
    discord: {
      sendAlert: mockDiscordSendAlert,
      sendRecovery: mockDiscordSendRecovery,
      sendDegraded: mockDiscordSendDegraded,
    },
    slack: {
      sendAlert: mockSlackSendAlert,
      sendRecovery: mockSlackSendRecovery,
      sendDegraded: mockSlackSendDegraded,
    },
    sms: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
    webhook: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
    telegram: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
    pagerduty: {
      sendAlert: mock(),
      sendRecovery: mock(),
      sendDegraded: mock(),
    },
    opsgenie: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
    ntfy: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
    "google-chat": {
      sendAlert: mock(),
      sendRecovery: mock(),
      sendDegraded: mock(),
    },
    "grafana-oncall": {
      sendAlert: mock(),
      sendRecovery: mock(),
      sendDegraded: mock(),
    },
    whatsapp: { sendAlert: mock(), sendRecovery: mock(), sendDegraded: mock() },
  },
}));

// Import after mocks are set up
const { triggerNotifications } = await import("./alerting");

// Seed data has: monitor 1 (workspace 1) linked to notification 1 (email provider)
// We use unique cronTimestamp per test to avoid unique constraint conflicts

describe("triggerNotifications", () => {
  afterEach(() => {
    mockEmailSendAlert.mockClear();
    mockEmailSendRecovery.mockClear();
    mockEmailSendDegraded.mockClear();
    mockSlackSendAlert.mockClear();
    mockSlackSendRecovery.mockClear();
    mockSlackSendDegraded.mockClear();
    mockDiscordSendAlert.mockClear();
    mockDiscordSendRecovery.mockClear();
    mockDiscordSendDegraded.mockClear();
  });

  afterAll(async () => {
    // Clean up notification triggers created during tests
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, 1))
      .run();
  });

  test("should send alert notification and return triggered list", async () => {
    const cronTimestamp = 9000001;

    const result = await triggerNotifications({
      monitorId: "1",
      statusCode: 500,
      message: "Internal Server Error",
      notifType: "alert",
      cronTimestamp,
      incidentId: undefined,
      regions: ["ams"],
      latency: 1500,
    });

    expect(mockEmailSendAlert).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      notificationId: 1,
      provider: "email",
    });
  });

  test("should send recovery notification and return triggered list", async () => {
    const cronTimestamp = 9000002;

    const result = await triggerNotifications({
      monitorId: "1",
      statusCode: 200,
      notifType: "recovery",
      cronTimestamp,
      regions: ["ams"],
    });

    expect(mockEmailSendRecovery).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      notificationId: 1,
      provider: "email",
    });
  });

  test("should send degraded notification and return triggered list", async () => {
    const cronTimestamp = 9000003;

    const result = await triggerNotifications({
      monitorId: "1",
      statusCode: 200,
      notifType: "degraded",
      cronTimestamp,
      latency: 5000,
      regions: ["ams"],
    });

    expect(mockEmailSendDegraded).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      notificationId: 1,
      provider: "email",
    });
  });

  test("should return empty list when monitor has no notifications", async () => {
    const cronTimestamp = 9000004;

    // Monitor 2 has no notifications linked in seed data
    const result = await triggerNotifications({
      monitorId: "2",
      statusCode: 500,
      notifType: "alert",
      cronTimestamp,
    });

    expect(mockEmailSendAlert).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  test("should skip duplicate notification trigger for same cronTimestamp", async () => {
    const cronTimestamp = 9000005;

    const first = await triggerNotifications({
      monitorId: "1",
      statusCode: 500,
      notifType: "alert",
      cronTimestamp,
    });

    expect(first).toHaveLength(1);
    mockEmailSendAlert.mockClear();

    // Same cronTimestamp should be skipped due to unique constraint
    const second = await triggerNotifications({
      monitorId: "1",
      statusCode: 500,
      notifType: "alert",
      cronTimestamp,
    });

    expect(mockEmailSendAlert).not.toHaveBeenCalled();
    expect(second).toHaveLength(0);
  });
});

describe("triggerNotifications with multiple providers", () => {
  const testNotificationIds: number[] = [];

  // Monitor 3 (workspace 1) exists in seed but has no notifications.
  // We link slack and discord notifications to it for this test suite.
  const testMonitorId = 3;

  afterEach(() => {
    mockEmailSendAlert.mockClear();
    mockSlackSendAlert.mockClear();
    mockDiscordSendAlert.mockClear();
    mockSlackSendRecovery.mockClear();
    mockDiscordSendRecovery.mockClear();
  });

  afterAll(async () => {
    // Clean up notification triggers
    await db
      .delete(notificationTrigger)
      .where(eq(notificationTrigger.monitorId, testMonitorId))
      .run();

    // Clean up notification-to-monitor links
    await db
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, testMonitorId))
      .run();

    // Clean up test notifications
    if (testNotificationIds.length > 0) {
      await db
        .delete(notification)
        .where(inArray(notification.id, testNotificationIds))
        .run();
    }
  });

  test("should trigger all linked providers and return each in the result", async () => {
    // Create slack notification
    const [slackNotif] = await db
      .insert(notification)
      .values({
        name: "test-slack",
        provider: "slack",
        data: '{"slack":"https://hooks.slack.com/test"}',
        workspaceId: 1,
      })
      .returning();

    // Create discord notification
    const [discordNotif] = await db
      .insert(notification)
      .values({
        name: "test-discord",
        provider: "discord",
        data: '{"discord":"https://discord.com/api/webhooks/test"}',
        workspaceId: 1,
      })
      .returning();

    testNotificationIds.push(slackNotif.id, discordNotif.id);

    // Link both to monitor 3
    await db
      .insert(notificationsToMonitors)
      .values([
        { monitorId: testMonitorId, notificationId: slackNotif.id },
        { monitorId: testMonitorId, notificationId: discordNotif.id },
      ])
      .run();

    const cronTimestamp = 9100001;

    const result = await triggerNotifications({
      monitorId: String(testMonitorId),
      statusCode: 500,
      message: "Server Error",
      notifType: "alert",
      cronTimestamp,
      regions: ["ams"],
    });

    expect(mockSlackSendAlert).toHaveBeenCalledTimes(1);
    expect(mockDiscordSendAlert).toHaveBeenCalledTimes(1);
    expect(mockEmailSendAlert).not.toHaveBeenCalled();

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      notificationId: slackNotif.id,
      provider: "slack",
    });
    expect(result).toContainEqual({
      notificationId: discordNotif.id,
      provider: "discord",
    });
  });

  test("should trigger recovery on all linked providers", async () => {
    const cronTimestamp = 9100002;

    const result = await triggerNotifications({
      monitorId: String(testMonitorId),
      statusCode: 200,
      notifType: "recovery",
      cronTimestamp,
      regions: ["ams"],
    });

    expect(mockSlackSendRecovery).toHaveBeenCalledTimes(1);
    expect(mockDiscordSendRecovery).toHaveBeenCalledTimes(1);

    expect(result).toHaveLength(2);
    const providers = result.map((r) => r.provider).sort();
    expect(providers).toEqual(["discord", "slack"]);
  });
});
