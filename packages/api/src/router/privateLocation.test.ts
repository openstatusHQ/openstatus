import { db, eq, inArray } from "@openstatus/db";
import {
  privateLocation,
  privateLocationToMonitors,
  workspace,
} from "@openstatus/db/src/schema";
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
function callerFor() {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal user for test
    user: { id: 1 },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: ownWorkspaceId },
  });
  return edgeRouter.createCaller(ctx);
}

// Own workspaces/monitors per suite — sharing the seeded monitor 5 / workspace
// 3 races sibling suites that read or mutate that monitor's associations.
let ownWorkspaceId: number;
let otherWorkspaceId: number;
let ownMonitorId: number;
let otherMonitorId: number;
let otherWorkspaceLocationId: number;
let ownWorkspaceLocationId: number;

beforeAll(async () => {
  const own = await createWorkspace();
  const other = await createWorkspace();
  ownWorkspaceId = own.id;
  otherWorkspaceId = other.id;

  const ownMonitor = await createMonitor(own.id);
  const otherMonitor = await createMonitor(other.id);
  ownMonitorId = ownMonitor.id;
  otherMonitorId = otherMonitor.id;

  const otherLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: other.id,
      name: "Other workspace location",
      token: `test-token-idor-${otherWorkspaceId}`,
    })
    .returning()
    .get();
  otherWorkspaceLocationId = otherLoc.id;

  await db
    .insert(privateLocationToMonitors)
    .values({
      privateLocationId: otherWorkspaceLocationId,
      monitorId: otherMonitorId,
    })
    .run();

  const ownLoc = await db
    .insert(privateLocation)
    .values({
      workspaceId: own.id,
      name: "Own workspace location",
      token: `test-token-own-${ownWorkspaceId}`,
    })
    .returning()
    .get();
  ownWorkspaceLocationId = ownLoc.id;
});

afterAll(async () => {
  await db
    .delete(privateLocationToMonitors)
    .where(
      inArray(privateLocationToMonitors.privateLocationId, [
        otherWorkspaceLocationId,
        ownWorkspaceLocationId,
      ]),
    )
    .catch(() => undefined);
  await db
    .delete(privateLocation)
    .where(
      inArray(privateLocation.id, [
        otherWorkspaceLocationId,
        ownWorkspaceLocationId,
      ]),
    )
    .catch(() => undefined);
  await db
    .delete(workspace)
    .where(inArray(workspace.id, [ownWorkspaceId, otherWorkspaceId]))
    .catch(() => undefined);
});

test("privateLocation.update rejects location from another workspace", async () => {
  const caller = callerFor();

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
  const caller = callerFor();

  const result = await caller.privateLocation.update({
    id: ownWorkspaceLocationId,
    name: "Updated Location Name",
    monitors: [ownMonitorId],
  });

  expect(result).toBeDefined();
  expect(result.name).toBe("Updated Location Name");
});

test("privateLocation.new rejects monitors from another workspace", async () => {
  const caller = callerFor();

  try {
    await caller.privateLocation.new({
      name: "Injected Location",
      token: "test-token-inject",
      monitors: [otherMonitorId],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("privateLocation.new succeeds with own workspace monitors", async () => {
  const caller = callerFor();

  const result = await caller.privateLocation.new({
    name: "Valid Location",
    token: "test-token-valid-new",
    monitors: [ownMonitorId],
  });

  expect(result).toBeDefined();
  expect(result.name).toBe("Valid Location");

  // Verify the monitor association was created
  const associations = await db.query.privateLocationToMonitors.findMany({
    where: eq(privateLocationToMonitors.privateLocationId, result.id),
  });
  expect(associations.length).toBe(1);
  expect(associations[0].monitorId).toBe(ownMonitorId);

  // Cleanup
  await db
    .delete(privateLocationToMonitors)
    .where(eq(privateLocationToMonitors.privateLocationId, result.id));
  await db.delete(privateLocation).where(eq(privateLocation.id, result.id));
});

test("privateLocation.update rejects monitors from another workspace", async () => {
  const caller = callerFor();

  try {
    await caller.privateLocation.update({
      id: ownWorkspaceLocationId,
      name: "Updated Location Name",
      monitors: [otherMonitorId],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("privateLocation.new persists metadata and defaults status", async () => {
  const caller = callerFor();

  const result = await caller.privateLocation.new({
    name: "Metadata Location",
    token: "test-token-metadata",
    monitors: [],
    metadata: { datacenter: "eu-west" },
  });

  expect(result.metadata).toEqual({ datacenter: "eu-west" });
  expect(result.status).toBe("error");

  await db.delete(privateLocation).where(eq(privateLocation.id, result.id));
});

test("privateLocation.update replaces metadata", async () => {
  const caller = callerFor();

  const result = await caller.privateLocation.update({
    id: ownWorkspaceLocationId,
    name: "Metadata Update",
    monitors: [ownMonitorId],
    metadata: { env: "prod" },
  });

  expect(result.metadata).toEqual({ env: "prod" });
  expect(result.status).toBe("error");
});
