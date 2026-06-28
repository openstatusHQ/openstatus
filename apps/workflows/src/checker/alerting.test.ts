import { db, eq, inArray } from "@openstatus/db";
import {
  notification,
  notificationTrigger,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import {
  afterAll,
  afterEach,
  assertSpyCalls,
  beforeEach,
  describe,
  expect,
  type Stub,
  stub,
  test,
} from "@openstatus/test-utils";

import { checkerAudit } from "../utils/audit-log";
import { triggerNotifications } from "./alerting";
import { providerToFunction } from "./utils";

// Deno has no module mocking, so we stub the methods on the real singletons
// that alerting.ts reads at call time. Stubbing per-test resolves them to no-op
// to avoid real HTTP / Tinybird calls and gives a fresh call count each test.
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous provider stubs
type AnyStub = Stub<any>;
let stubs: AnyStub[] = [];

const stubSend = (
  provider: "email" | "slack" | "discord",
  verb: "sendAlert" | "sendRecovery" | "sendDegraded",
): AnyStub => {
  const s = stub(providerToFunction[provider], verb, () => Promise.resolve());
  stubs.push(s);
  return s;
};

let mockEmailSendAlert: AnyStub;
let mockEmailSendRecovery: AnyStub;
let mockEmailSendDegraded: AnyStub;
let mockSlackSendAlert: AnyStub;
let mockSlackSendRecovery: AnyStub;
let mockSlackSendDegraded: AnyStub;
let mockDiscordSendAlert: AnyStub;
let mockDiscordSendRecovery: AnyStub;
let mockDiscordSendDegraded: AnyStub;

// Seed data has: monitor 1 (workspace 1) linked to notification 1 (email provider)
// We use unique cronTimestamp per test to avoid unique constraint conflicts

beforeEach(() => {
  stubs = [];
  // biome-ignore lint/suspicious/noExplicitAny: avoid Tinybird call
  stubs.push(
    stub(checkerAudit, "publishAuditLog", () => Promise.resolve()) as AnyStub,
  );
  mockEmailSendAlert = stubSend("email", "sendAlert");
  mockEmailSendRecovery = stubSend("email", "sendRecovery");
  mockEmailSendDegraded = stubSend("email", "sendDegraded");
  mockSlackSendAlert = stubSend("slack", "sendAlert");
  mockSlackSendRecovery = stubSend("slack", "sendRecovery");
  mockSlackSendDegraded = stubSend("slack", "sendDegraded");
  mockDiscordSendAlert = stubSend("discord", "sendAlert");
  mockDiscordSendRecovery = stubSend("discord", "sendRecovery");
  mockDiscordSendDegraded = stubSend("discord", "sendDegraded");
});

afterEach(() => {
  for (const s of stubs) s.restore();
  stubs = [];
});

describe("triggerNotifications", () => {
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

    assertSpyCalls(mockEmailSendAlert, 1);
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

    assertSpyCalls(mockEmailSendRecovery, 1);
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

    assertSpyCalls(mockEmailSendDegraded, 1);
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

    assertSpyCalls(mockEmailSendAlert, 0);
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
    assertSpyCalls(mockEmailSendAlert, 1);

    // Same cronTimestamp should be skipped due to unique constraint
    const second = await triggerNotifications({
      monitorId: "1",
      statusCode: 500,
      notifType: "alert",
      cronTimestamp,
    });

    // still only the first call — the duplicate was skipped
    assertSpyCalls(mockEmailSendAlert, 1);
    expect(second).toHaveLength(0);
  });
});

describe("triggerNotifications with multiple providers", () => {
  const testNotificationIds: number[] = [];

  // Monitor 3 (workspace 1) exists in seed but has no notifications.
  // We link slack and discord notifications to it for this test suite.
  const testMonitorId = 3;

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

    assertSpyCalls(mockSlackSendAlert, 1);
    assertSpyCalls(mockDiscordSendAlert, 1);
    assertSpyCalls(mockEmailSendAlert, 0);

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

    assertSpyCalls(mockSlackSendRecovery, 1);
    assertSpyCalls(mockDiscordSendRecovery, 1);

    expect(result).toHaveLength(2);
    const providers = result.map((r) => r.provider).sort();
    expect(providers).toEqual(["discord", "slack"]);
  });
});
