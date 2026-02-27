import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspaceMonitorId: number;

beforeAll(async () => {
  const m = await db
    .insert(monitor)
    .values({
      workspaceId: 2,
      name: "Other workspace monitor",
      jobType: "http",
      periodicity: "1m",
      url: "https://example.com",
      regions: "ams",
      active: true,
    })
    .returning()
    .get();
  otherWorkspaceMonitorId = m.id;
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.id, otherWorkspaceMonitorId));
});

test("pageComponent.updateOrder rejects monitorId from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1, limits: allPlans.team.limits },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.pageComponent.updateOrder({
      pageId: 1, // page 1 belongs to workspace 1
      components: [
        {
          id: 1,
          monitorId: otherWorkspaceMonitorId, // monitor from workspace 2
          order: 0,
          name: "Injected Monitor",
          type: "monitor",
        },
      ],
      groups: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("pageComponent.updateOrder rejects monitorId from another workspace in groups", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1, limits: allPlans.team.limits },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.pageComponent.updateOrder({
      pageId: 1,
      components: [],
      groups: [
        {
          order: 0,
          name: "Injected Group",
          components: [
            {
              monitorId: otherWorkspaceMonitorId, // monitor from workspace 2
              order: 0,
              name: "Injected Monitor in Group",
              type: "monitor",
            },
          ],
        },
      ],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }
});

test("pageComponent.updateOrder succeeds with own workspace monitorId", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1, limits: allPlans.team.limits },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.pageComponent.updateOrder({
    pageId: 1,
    components: [
      {
        monitorId: 1, // monitor 1 belongs to workspace 1
        order: 0,
        name: "OpenStatus Monitor",
        type: "monitor",
      },
      {
        monitorId: 2, // monitor 2 belongs to workspace 1
        order: 1,
        name: "Google Monitor",
        type: "monitor",
      },
    ],
    groups: [],
  });

  expect(result).toEqual({ success: true });
});
