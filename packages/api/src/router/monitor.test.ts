import { db, eq, inArray } from "@openstatus/db";
import {
  monitorTag,
  monitorTagsToMonitors,
  notification,
  notificationsToMonitors,
  privateLocation,
  privateLocationToMonitors,
  workspace,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import {
  createMonitor,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

// Passing both `user` and `workspace` trips the NODE_ENV=test escape hatch in
// the authed middleware, so the caller is scoped to ownWorkspaceId instead of
// resolving the seeded workspace for the session user.
function callerFor(limits?: typeof allPlans.team.limits) {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal user for test
    user: { id: 1 },
    // @ts-expect-error - minimal workspace for test
    workspace: limits ? { id: ownWorkspaceId, limits } : { id: ownWorkspaceId },
  });
  return edgeRouter.createCaller(ctx);
}

// Own workspaces/monitors per suite — these IDOR tests previously shared the
// seeded monitor 5 / workspace 3, which races sibling suites mutating that
// monitor's associations (e.g. privateLocation.test).
let ownWorkspaceId: number;
let otherWorkspaceId: number;
let ownMonitorId: number;
let otherMonitorId: number;
let tagId: number;
let notifierId: number;
let otherWorkspacePrivateLocationId: number;
let ownWorkspacePrivateLocationId: number;

beforeAll(async () => {
  const own = await createWorkspace();
  const other = await createWorkspace();
  ownWorkspaceId = own.id;
  otherWorkspaceId = other.id;

  const ownMonitor = await createMonitor(own.id);
  const otherMonitor = await createMonitor(other.id);
  ownMonitorId = ownMonitor.id;
  otherMonitorId = otherMonitor.id;

  const tag = await db
    .insert(monitorTag)
    .values({ workspaceId: own.id, name: "idor-test-tag", color: "#ff0000" })
    .returning()
    .get();
  tagId = tag.id;

  const notif = await db
    .insert(notification)
    .values({
      workspaceId: own.id,
      name: "idor-test-notif",
      provider: "email",
      data: JSON.stringify({ email: "test@example.com" }),
    })
    .returning()
    .get();
  notifierId = notif.id;

  const otherLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: other.id,
      name: "Other workspace private location",
      token: `monitor-test-other-${otherWorkspaceId}`,
    })
    .returning()
    .get();
  otherWorkspacePrivateLocationId = otherLoc.id;

  const ownLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: own.id,
      name: "Own workspace private location",
      token: `monitor-test-own-${ownWorkspaceId}`,
    })
    .returning()
    .get();
  ownWorkspacePrivateLocationId = ownLoc.id;

  // Pre-existing association on the cross-workspace monitor; the IDOR test
  // asserts a rejected scheduling update does not wipe it.
  await db
    .insert(privateLocationToMonitors)
    .values({ privateLocationId: otherLoc.id, monitorId: otherMonitor.id })
    .run();
});

afterAll(async () => {
  await db
    .delete(privateLocationToMonitors)
    .where(
      inArray(privateLocationToMonitors.privateLocationId, [
        otherWorkspacePrivateLocationId,
        ownWorkspacePrivateLocationId,
      ]),
    )
    .catch(() => undefined);
  await db
    .delete(privateLocation)
    .where(
      inArray(privateLocation.id, [
        otherWorkspacePrivateLocationId,
        ownWorkspacePrivateLocationId,
      ]),
    )
    .catch(() => undefined);
  await db
    .delete(monitorTagsToMonitors)
    .where(eq(monitorTagsToMonitors.monitorTagId, tagId))
    .catch(() => undefined);
  await db
    .delete(monitorTag)
    .where(eq(monitorTag.id, tagId))
    .catch(() => undefined);
  await db
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.notificationId, notifierId))
    .catch(() => undefined);
  await db
    .delete(notification)
    .where(eq(notification.id, notifierId))
    .catch(() => undefined);
  await db
    .delete(workspace)
    .where(inArray(workspace.id, [ownWorkspaceId, otherWorkspaceId]))
    .catch(() => undefined);
});

test("monitor.updateTags rejects monitor from another workspace", async () => {
  const caller = callerFor();

  try {
    await caller.monitor.updateTags({ id: otherMonitorId, tags: [] });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("monitor.updateTags succeeds for own workspace monitor", async () => {
  const caller = callerFor();

  await caller.monitor.updateTags({ id: ownMonitorId, tags: [tagId] });

  const result = await db.query.monitorTagsToMonitors.findFirst({
    where: eq(monitorTagsToMonitors.monitorId, ownMonitorId),
  });
  expect(result).toBeDefined();
  expect(result?.monitorTagId).toBe(tagId);
});

test("monitor.updateNotifiers rejects monitor from another workspace", async () => {
  const caller = callerFor();

  try {
    await caller.monitor.updateNotifiers({ id: otherMonitorId, notifiers: [] });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("monitor.updateNotifiers succeeds for own workspace monitor", async () => {
  const caller = callerFor();

  await caller.monitor.updateNotifiers({
    id: ownMonitorId,
    notifiers: [notifierId],
  });
});

test("monitor.updateSchedulingRegions rejects monitor from another workspace", async () => {
  const caller = callerFor(allPlans.team.limits);

  // Verify the seed private location association exists before the attack
  const before = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.monitorId, otherMonitorId),
  });
  const beforeCount = before.length;

  try {
    await caller.monitor.updateSchedulingRegions({
      id: otherMonitorId,
      regions: ["ams"],
      periodicity: "30s",
      privateLocations: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify private location associations were NOT deleted
  const after = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.monitorId, otherMonitorId),
  });
  expect(after.length).toBe(beforeCount);
});

test("monitor.updateSchedulingRegions succeeds for own workspace monitor", async () => {
  const caller = callerFor(allPlans.team.limits);

  await caller.monitor.updateSchedulingRegions({
    id: ownMonitorId,
    regions: ["ams"],
    periodicity: "1m",
    privateLocations: [],
  });
});

test("monitor.updateSchedulingRegions rejects privateLocations from another workspace", async () => {
  const caller = callerFor(allPlans.team.limits);

  try {
    await caller.monitor.updateSchedulingRegions({
      id: ownMonitorId,
      regions: ["ams"],
      periodicity: "1m",
      privateLocations: [otherWorkspacePrivateLocationId],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("monitor.updateSchedulingRegions succeeds with own workspace privateLocations", async () => {
  const caller = callerFor(allPlans.team.limits);

  await caller.monitor.updateSchedulingRegions({
    id: ownMonitorId,
    regions: ["ams"],
    periodicity: "1m",
    privateLocations: [ownWorkspacePrivateLocationId],
  });

  const associations = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.monitorId, ownMonitorId),
  });
  const linked = associations.find(
    (a) => a.privateLocationId === ownWorkspacePrivateLocationId,
  );
  expect(linked).toBeDefined();
});
