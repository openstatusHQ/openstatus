import { expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../../edge";
import { createInnerTRPCContext } from "../../trpc";

// Workspace 1 owns monitor 1; monitor 5 belongs to workspace 3.
// These IDs come from the seed data (packages/db/src/seed.mts).

function callerForWorkspace(workspaceId: number) {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId, plan: "team" },
  });
  return edgeRouter.createCaller(ctx);
}

// ─── metricsLatency ──────────────────────────────────────────────

test("tinybird.metricsLatency rejects monitor from another workspace", async () => {
  const caller = callerForWorkspace(1);

  try {
    // Monitor 5 belongs to workspace 3
    await caller.tinybird.metricsLatency({
      monitorId: "5",
      period: "1d",
      type: "http",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("tinybird.metricsLatency succeeds for own workspace monitor", async () => {
  const caller = callerForWorkspace(1);

  // Monitor 1 belongs to workspace 1 — should not throw
  const result = await caller.tinybird.metricsLatency({
    monitorId: "1",
    period: "1d",
    type: "http",
  });
  expect(result).toBeDefined();
});

// ─── metricsTimingPhases ─────────────────────────────────────────

test("tinybird.metricsTimingPhases rejects monitor from another workspace", async () => {
  const caller = callerForWorkspace(1);

  try {
    // Monitor 5 belongs to workspace 3
    await caller.tinybird.metricsTimingPhases({
      monitorId: "5",
      period: "1d",
      type: "http",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("tinybird.metricsTimingPhases succeeds for own workspace monitor", async () => {
  const caller = callerForWorkspace(1);

  // Monitor 1 belongs to workspace 1 — should not throw
  const result = await caller.tinybird.metricsTimingPhases({
    monitorId: "1",
    period: "1d",
    type: "http",
  });
  expect(result).toBeDefined();
});
