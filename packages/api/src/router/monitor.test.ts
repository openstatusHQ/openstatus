import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  monitorTag,
  monitorTagsToMonitors,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let tagId: number;

beforeAll(async () => {
  const tag = await db
    .insert(monitorTag)
    .values({
      workspaceId: 1,
      name: "idor-test-tag",
      color: "#ff0000",
    })
    .returning()
    .get();
  tagId = tag.id;
});

afterAll(async () => {
  await db
    .delete(monitorTagsToMonitors)
    .where(eq(monitorTagsToMonitors.monitorTagId, tagId));
  await db.delete(monitorTag).where(eq(monitorTag.id, tagId));
});

test("monitor.updateTags rejects monitor from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.monitor.updateTags({ id: 5, tags: [] });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("monitor.updateTags succeeds for own workspace monitor", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  await caller.monitor.updateTags({ id: 1, tags: [tagId] });

  const result = await db.query.monitorTagsToMonitors.findFirst({
    where: eq(monitorTagsToMonitors.monitorId, 1),
  });
  expect(result).toBeDefined();
  expect(result?.monitorTagId).toBe(tagId);
});

test("monitor.updateNotifiers rejects monitor from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.monitor.updateNotifiers({ id: 5, notifiers: [] });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("monitor.updateNotifiers succeeds for own workspace monitor", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  await caller.monitor.updateNotifiers({ id: 1, notifiers: [1] });
});

test("monitor.updateSchedulingRegions rejects monitor from another workspace", async () => {
  // Monitor 5 belongs to workspace 3; try to update it from workspace 1
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1, limits: allPlans.team.limits },
  });
  const caller = edgeRouter.createCaller(ctx);

  // Verify the seed private location association exists before the attack
  const before = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.monitorId, 5),
  });
  const beforeCount = before.length;

  try {
    await caller.monitor.updateSchedulingRegions({
      id: 5,
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
    where: eq(privateLocationToMonitors.monitorId, 5),
  });
  expect(after.length).toBe(beforeCount);
});

test("monitor.updateSchedulingRegions succeeds for own workspace monitor", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1, limits: allPlans.team.limits },
  });
  const caller = edgeRouter.createCaller(ctx);

  // Monitor 1 belongs to workspace 1
  await caller.monitor.updateSchedulingRegions({
    id: 1,
    regions: ["ams"],
    periodicity: "1m",
    privateLocations: [],
  });
});
