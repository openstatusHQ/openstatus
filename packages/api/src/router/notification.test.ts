import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspaceNotifId: number;

beforeAll(async () => {
  const notif = await db
    .insert(notification)
    .values({
      provider: "email",
      name: "workspace 2 idor test notification",
      data: '{"email":"test@openstatus.dev"}',
      workspaceId: 2,
    })
    .returning()
    .get();
  otherWorkspaceNotifId = notif.id;

  // Link the other workspace's notification to a monitor so we can verify
  // the junction table is not wiped by a cross-workspace updateNotifier call
  await db
    .insert(notificationsToMonitors)
    .values({ notificationId: otherWorkspaceNotifId, monitorId: 5 })
    .run();
});

afterAll(async () => {
  await db
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, otherWorkspaceNotifId));
  await db
    .delete(notification)
    .where(eq(notification.id, otherWorkspaceNotifId));
});

test("notification.delete does not delete a notification from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  await caller.notification.delete({ id: otherWorkspaceNotifId });

  const notifAfter = await db.query.notification.findFirst({
    where: eq(notification.id, otherWorkspaceNotifId),
  });
  expect(notifAfter).toBeDefined();
  expect(notifAfter?.id).toBe(otherWorkspaceNotifId);
});

test("notification.delete succeeds for own workspace notification", async () => {
  const tempNotif = await db
    .insert(notification)
    .values({
      provider: "email",
      name: "temp test notification",
      data: '{"email":"temp@openstatus.dev"}',
      workspaceId: 1,
    })
    .returning()
    .get();

  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  await caller.notification.delete({ id: tempNotif.id });

  const notifAfter = await db.query.notification.findFirst({
    where: eq(notification.id, tempNotif.id),
  });
  expect(notifAfter).toBeUndefined();
});

test("notification.updateNotifier rejects notification from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.notification.updateNotifier({
      id: otherWorkspaceNotifId,
      name: "Hacked notification",
      data: { email: "hacker@evil.com" },
      monitors: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify monitor associations were NOT deleted
  const associations = await db.query.notificationsToMonitors.findMany({
    where: eq(notificationsToMonitors.notificationId, otherWorkspaceNotifId),
  });
  expect(associations.length).toBe(1);
});
