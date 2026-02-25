import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { notification } from "@openstatus/db/src/schema";

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
});

afterAll(async () => {
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
