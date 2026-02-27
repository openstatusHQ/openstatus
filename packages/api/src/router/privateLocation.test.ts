import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspaceLocationId: number;
let ownWorkspaceLocationId: number;

beforeAll(async () => {
  const otherLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: 2,
      name: "Other workspace location",
      token: "test-token-idor",
    })
    .returning()
    .get();
  otherWorkspaceLocationId = otherLoc.id;

  await db
    .insert(privateLocationToMonitors)
    .values({
      privateLocationId: otherWorkspaceLocationId,
      monitorId: 5,
    })
    .run();

  const ownLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: 1,
      name: "Own workspace location",
      token: "test-token-own",
    })
    .returning()
    .get();
  ownWorkspaceLocationId = ownLoc.id;
});

afterAll(async () => {
  await db
    .delete(privateLocationToMonitors)
    .where(
      eq(privateLocationToMonitors.privateLocationId, otherWorkspaceLocationId),
    );
  await db
    .delete(privateLocation)
    .where(eq(privateLocation.id, otherWorkspaceLocationId));
  await db
    .delete(privateLocationToMonitors)
    .where(
      eq(privateLocationToMonitors.privateLocationId, ownWorkspaceLocationId),
    );
  await db
    .delete(privateLocation)
    .where(eq(privateLocation.id, ownWorkspaceLocationId));
});

test("privateLocation.update rejects location from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.privateLocation.update({
      id: otherWorkspaceLocationId,
      name: "Unauthorized Name Change",
      monitors: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify monitor associations were NOT deleted
  const associations = await db.query.privateLocationToMonitors.findMany({
    where: eq(
      privateLocationToMonitors.privateLocationId,
      otherWorkspaceLocationId,
    ),
  });
  expect(associations.length).toBe(1);
});

test("privateLocation.update succeeds for own workspace location", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.privateLocation.update({
    id: ownWorkspaceLocationId,
    name: "Updated Location Name",
    monitors: [1],
  });

  expect(result).toBeDefined();
  expect(result.name).toBe("Updated Location Name");
});

test("privateLocation.new rejects monitors from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.privateLocation.new({
      name: "Injected Location",
      token: "test-token-inject",
      monitors: [5], // monitor 5 belongs to workspace 3
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("privateLocation.new succeeds with own workspace monitors", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.privateLocation.new({
    name: "Valid Location",
    token: "test-token-valid-new",
    monitors: [1], // monitor 1 belongs to workspace 1
  });

  expect(result).toBeDefined();
  expect(result.name).toBe("Valid Location");

  // Verify the monitor association was created
  const associations = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.privateLocationId, result.id),
  });
  expect(associations.length).toBe(1);
  expect(associations[0].monitorId).toBe(1);

  // Cleanup
  await db
    .delete(privateLocationToMonitors)
    .where(eq(privateLocationToMonitors.privateLocationId, result.id));
  await db.delete(privateLocation).where(eq(privateLocation.id, result.id));
});

test("privateLocation.update rejects monitors from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.privateLocation.update({
      id: ownWorkspaceLocationId,
      name: "Updated Location Name",
      monitors: [5], // monitor 5 belongs to workspace 3
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});
