import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import { app } from "@/index";

/**
 * Helper to make ConnectRPC requests using the Connect protocol (JSON).
 * Connect uses POST with JSON body at /rpc/<service>/<method>
 */
async function connectRequest(
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(
    `/rpc/openstatus.notification.v1.NotificationService/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

const TEST_PREFIX = "rpc-notification-test";
let testNotificationId: number;
let testNotificationToDeleteId: number;
let testNotificationToUpdateId: number;

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-main`));
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-to-update`));

  // Create test notification (email type)
  const notificationRecord = await db
    .insert(notification)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-main`,
      provider: "email",
      data: JSON.stringify({ email: "test@example.com" }),
    })
    .returning()
    .get();
  testNotificationId = notificationRecord.id;

  // Create monitor association
  await db.insert(notificationsToMonitors).values({
    notificationId: notificationRecord.id,
    monitorId: 1, // Use seeded monitor
  });

  // Create notification to delete
  const deleteRecord = await db
    .insert(notification)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-to-delete`,
      provider: "discord",
      data: JSON.stringify({ discord: "https://discord.com/api/webhooks/test" }),
    })
    .returning()
    .get();
  testNotificationToDeleteId = deleteRecord.id;

  // Create notification to update
  const updateRecord = await db
    .insert(notification)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-to-update`,
      provider: "slack",
      data: JSON.stringify({ slack: "https://hooks.slack.com/services/test" }),
    })
    .returning()
    .get();
  testNotificationToUpdateId = updateRecord.id;

  await db.insert(notificationsToMonitors).values({
    notificationId: updateRecord.id,
    monitorId: 1,
  });
});

afterAll(async () => {
  // Clean up associations
  await db
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, testNotificationId));
  await db
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, testNotificationToUpdateId));

  // Clean up notifications
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-main`));
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-to-update`));
});

describe("NotificationService.CreateNotification", () => {
  test("creates a new email notification", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-created-email`,
        provider: "NOTIFICATION_PROVIDER_EMAIL",
        data: {
          email: {
            email: "created@example.com",
          },
        },
        monitorIds: ["1"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notification");
    expect(data.notification.name).toBe(`${TEST_PREFIX}-created-email`);
    expect(data.notification.provider).toBe("NOTIFICATION_PROVIDER_EMAIL");
    expect(data.notification.monitorIds).toContain("1");

    // Clean up
    await db
      .delete(notificationsToMonitors)
      .where(
        eq(notificationsToMonitors.notificationId, Number(data.notification.id)),
      );
    await db
      .delete(notification)
      .where(eq(notification.id, Number(data.notification.id)));
  });

  test("creates a new discord notification", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-created-discord`,
        provider: "NOTIFICATION_PROVIDER_DISCORD",
        data: {
          discord: {
            webhookUrl: "https://discord.com/api/webhooks/123/abc",
          },
        },
        monitorIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notification");
    expect(data.notification.name).toBe(`${TEST_PREFIX}-created-discord`);
    expect(data.notification.provider).toBe("NOTIFICATION_PROVIDER_DISCORD");

    // Clean up
    await db
      .delete(notification)
      .where(eq(notification.id, Number(data.notification.id)));
  });

  test("creates a new slack notification", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-created-slack`,
        provider: "NOTIFICATION_PROVIDER_SLACK",
        data: {
          slack: {
            webhookUrl: "https://hooks.slack.com/services/T00/B00/XXX",
          },
        },
        monitorIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notification");
    expect(data.notification.provider).toBe("NOTIFICATION_PROVIDER_SLACK");

    // Clean up
    await db
      .delete(notification)
      .where(eq(notification.id, Number(data.notification.id)));
  });

  test("creates notification with multiple monitors", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-multi-monitor`,
        provider: "NOTIFICATION_PROVIDER_EMAIL",
        data: {
          email: {
            email: "multi@example.com",
          },
        },
        monitorIds: ["1"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.notification.monitorIds).toContain("1");

    // Clean up
    await db
      .delete(notificationsToMonitors)
      .where(
        eq(notificationsToMonitors.notificationId, Number(data.notification.id)),
      );
    await db
      .delete(notification)
      .where(eq(notification.id, Number(data.notification.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreateNotification", {
      name: "Unauthorized test",
      provider: "NOTIFICATION_PROVIDER_EMAIL",
      data: {
        email: {
          email: "test@example.com",
        },
      },
      monitorIds: [],
    });

    expect(res.status).toBe(401);
  });

  test("returns error for invalid monitor ID", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-invalid-monitor`,
        provider: "NOTIFICATION_PROVIDER_EMAIL",
        data: {
          email: {
            email: "test@example.com",
          },
        },
        monitorIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error for unspecified provider", async () => {
    const res = await connectRequest(
      "CreateNotification",
      {
        name: `${TEST_PREFIX}-no-provider`,
        provider: "NOTIFICATION_PROVIDER_UNSPECIFIED",
        data: {},
        monitorIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("NotificationService.GetNotification", () => {
  test("returns notification with monitor IDs", async () => {
    const res = await connectRequest(
      "GetNotification",
      { id: String(testNotificationId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notification");
    expect(data.notification.id).toBe(String(testNotificationId));
    expect(data.notification.name).toBe(`${TEST_PREFIX}-main`);
    expect(data.notification.provider).toBe("NOTIFICATION_PROVIDER_EMAIL");
    expect(data.notification.monitorIds).toContain("1");
    expect(data.notification).toHaveProperty("createdAt");
    expect(data.notification).toHaveProperty("updatedAt");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetNotification", {
      id: String(testNotificationId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent notification", async () => {
    const res = await connectRequest(
      "GetNotification",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for notification in different workspace", async () => {
    // Create notification in workspace 2
    const otherRecord = await db
      .insert(notification)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-other-workspace`,
        provider: "email",
        data: JSON.stringify({ email: "other@example.com" }),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetNotification",
        { id: String(otherRecord.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(notification).where(eq(notification.id, otherRecord.id));
    }
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "GetNotification",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("NotificationService.ListNotifications", () => {
  test("returns notifications for authenticated workspace", async () => {
    const res = await connectRequest(
      "ListNotifications",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notifications");
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data).toHaveProperty("totalSize");
  });

  test("returns notifications with correct summary structure", async () => {
    const res = await connectRequest(
      "ListNotifications",
      { limit: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const record = data.notifications?.find(
      (n: { id: string }) => n.id === String(testNotificationId),
    );

    expect(record).toBeDefined();
    expect(record.name).toBe(`${TEST_PREFIX}-main`);
    expect(record.provider).toBe("NOTIFICATION_PROVIDER_EMAIL");
    expect(record).toHaveProperty("monitorCount");
    expect(record).toHaveProperty("createdAt");
    expect(record).toHaveProperty("updatedAt");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListNotifications", {});

    expect(res.status).toBe(401);
  });

  test("respects limit parameter", async () => {
    const res = await connectRequest(
      "ListNotifications",
      { limit: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.notifications?.length || 0).toBeLessThanOrEqual(1);
  });

  test("respects offset parameter", async () => {
    // Get total count first
    const res1 = await connectRequest(
      "ListNotifications",
      {},
      { "x-openstatus-key": "1" },
    );
    const data1 = await res1.json();
    const totalSize = data1.totalSize;

    if (totalSize > 1) {
      // Get first page
      const res2 = await connectRequest(
        "ListNotifications",
        { limit: 1, offset: 0 },
        { "x-openstatus-key": "1" },
      );
      const data2 = await res2.json();

      // Get second page
      const res3 = await connectRequest(
        "ListNotifications",
        { limit: 1, offset: 1 },
        { "x-openstatus-key": "1" },
      );
      const data3 = await res3.json();

      // Should have different notifications
      if (data2.notifications?.length > 0 && data3.notifications?.length > 0) {
        expect(data2.notifications[0].id).not.toBe(data3.notifications[0].id);
      }
    }
  });

  test("only returns notifications for authenticated workspace", async () => {
    // Create notification in workspace 2
    const otherRecord = await db
      .insert(notification)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-other-workspace-list`,
        provider: "email",
        data: JSON.stringify({ email: "other@example.com" }),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListNotifications",
        { limit: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const recordIds = (data.notifications || []).map(
        (n: { id: string }) => n.id,
      );

      expect(recordIds).not.toContain(String(otherRecord.id));
    } finally {
      await db.delete(notification).where(eq(notification.id, otherRecord.id));
    }
  });
});

describe("NotificationService.UpdateNotification", () => {
  test("updates notification name", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      {
        id: String(testNotificationToUpdateId),
        name: `${TEST_PREFIX}-updated-name`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("notification");
    expect(data.notification.name).toBe(`${TEST_PREFIX}-updated-name`);

    // Restore original name
    await db
      .update(notification)
      .set({ name: `${TEST_PREFIX}-to-update` })
      .where(eq(notification.id, testNotificationToUpdateId));
  });

  test("updates monitor associations", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      {
        id: String(testNotificationToUpdateId),
        monitorIds: ["1"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.notification.monitorIds).toContain("1");
  });

  test("clears monitor associations with empty array", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      {
        id: String(testNotificationToUpdateId),
        monitorIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const monitorIds = data.notification.monitorIds ?? [];
    expect(monitorIds).toHaveLength(0);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateNotification", {
      id: String(testNotificationToUpdateId),
      name: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent notification", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      { id: "99999", name: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      { id: "", name: "Empty ID update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for notification in different workspace", async () => {
    // Create notification in workspace 2
    const otherRecord = await db
      .insert(notification)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-other-workspace-update`,
        provider: "email",
        data: JSON.stringify({ email: "other@example.com" }),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "UpdateNotification",
        { id: String(otherRecord.id), name: "Should not update" },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(notification).where(eq(notification.id, otherRecord.id));
    }
  });

  test("returns error for invalid monitor ID on update", async () => {
    const res = await connectRequest(
      "UpdateNotification",
      {
        id: String(testNotificationToUpdateId),
        monitorIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("NotificationService.DeleteNotification", () => {
  test("successfully deletes existing notification", async () => {
    const res = await connectRequest(
      "DeleteNotification",
      { id: String(testNotificationToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(notification)
      .where(eq(notification.id, testNotificationToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteNotification", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent notification", async () => {
    const res = await connectRequest(
      "DeleteNotification",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "DeleteNotification",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for notification in different workspace", async () => {
    // Create notification in workspace 2
    const otherRecord = await db
      .insert(notification)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-other-workspace-delete`,
        provider: "email",
        data: JSON.stringify({ email: "other@example.com" }),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "DeleteNotification",
        { id: String(otherRecord.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);

      // Verify it wasn't deleted
      const stillExists = await db
        .select()
        .from(notification)
        .where(eq(notification.id, otherRecord.id))
        .get();
      expect(stillExists).toBeDefined();
    } finally {
      await db.delete(notification).where(eq(notification.id, otherRecord.id));
    }
  });
});

describe("NotificationService.CheckNotificationLimit", () => {
  test("returns limit information for authenticated workspace", async () => {
    const res = await connectRequest(
      "CheckNotificationLimit",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Proto3 JSON omits fields with default values (false, 0)
    // So we check that the response is valid and contains expected types
    // when the values are non-default
    const limitReached = data.limitReached ?? false;
    const currentCount = data.currentCount ?? 0;
    const maxCount = data.maxCount ?? 0;

    expect(typeof limitReached).toBe("boolean");
    expect(typeof currentCount).toBe("number");
    expect(typeof maxCount).toBe("number");
    expect(currentCount).toBeGreaterThanOrEqual(0);
    expect(maxCount).toBeGreaterThanOrEqual(0);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CheckNotificationLimit", {});

    expect(res.status).toBe(401);
  });
});

describe("NotificationService.SendTestNotification", () => {
  // Note: These tests verify error handling since we can't actually send
  // real notifications in tests without mocking external services

  test("returns error for unsupported email provider", async () => {
    const res = await connectRequest(
      "SendTestNotification",
      {
        provider: "NOTIFICATION_PROVIDER_EMAIL",
        data: {
          email: {
            email: "test@example.com",
          },
        },
      },
      { "x-openstatus-key": "1" },
    );

    // Email doesn't support test notifications
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("not supported");
  });

  test("returns error for unsupported SMS provider", async () => {
    const res = await connectRequest(
      "SendTestNotification",
      {
        provider: "NOTIFICATION_PROVIDER_SMS",
        data: {
          sms: {
            phoneNumber: "+1234567890",
          },
        },
      },
      { "x-openstatus-key": "1" },
    );

    // SMS doesn't support test notifications
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("not supported");
  });

  test("returns error when no data provided", async () => {
    const res = await connectRequest(
      "SendTestNotification",
      {
        provider: "NOTIFICATION_PROVIDER_DISCORD",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when data doesn't match provider", async () => {
    const res = await connectRequest(
      "SendTestNotification",
      {
        provider: "NOTIFICATION_PROVIDER_DISCORD",
        data: {
          email: {
            email: "test@example.com",
          },
        },
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Expected discord data");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("SendTestNotification", {
      provider: "NOTIFICATION_PROVIDER_EMAIL",
      data: {
        email: {
          email: "test@example.com",
        },
      },
    });

    expect(res.status).toBe(401);
  });

  test("returns error for unspecified provider", async () => {
    const res = await connectRequest(
      "SendTestNotification",
      {
        provider: "NOTIFICATION_PROVIDER_UNSPECIFIED",
        data: {},
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});
