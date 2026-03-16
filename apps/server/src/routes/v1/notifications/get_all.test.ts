import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { notification } from "@openstatus/db/src/schema";

import { app } from "@/index";
import { NotificationSchema } from "./schema";

const TEST_PREFIX = "v1-notif-getall-test";
let testNotificationId: number;

beforeAll(async () => {
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-email`));

  const notif = await db
    .insert(notification)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-email`,
      provider: "email",
      data: '{"email":"test@test.com"}',
    })
    .returning()
    .get();
  testNotificationId = notif.id;
});

afterAll(async () => {
  await db
    .delete(notification)
    .where(eq(notification.name, `${TEST_PREFIX}-email`));
});

test("return all notifications", async () => {
  const res = await app.request("/v1/notification", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = NotificationSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.some((n) => n.id === testNotificationId)).toBe(true);
});

test("return empty notifications", async () => {
  const res = await app.request("/v1/notification", {
    method: "GET",
    headers: {
      "x-openstatus-key": "3",
    },
  });

  const result = NotificationSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/notification", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
