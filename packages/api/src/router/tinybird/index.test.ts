import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
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

// ─── listInfinite / listFacets ───────────────────────────────────

test("tinybird.listInfinite rejects monitor from another workspace", async () => {
  const caller = callerForWorkspace(1);

  try {
    // Monitor 5 belongs to workspace 3
    await caller.tinybird.listInfinite({ monitorId: 5, limit: 50 });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("tinybird.listInfinite succeeds for own workspace monitor", async () => {
  const caller = callerForWorkspace(1);

  const result = await caller.tinybird.listInfinite({
    monitorId: 1,
    limit: 50,
  });
  expect(result).toEqual({ data: [], nextCursor: null, prevCursor: null });
});

test("tinybird.listFacets rejects monitor from another workspace", async () => {
  const caller = callerForWorkspace(1);

  try {
    await caller.tinybird.listFacets({ monitorId: 5 });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("tinybird.listFacets succeeds for own workspace monitor", async () => {
  const caller = callerForWorkspace(1);

  const result = await caller.tinybird.listFacets({ monitorId: 1 });
  expect(result).toEqual({
    totalRowCount: 0,
    filterRowCount: 0,
    facets: {},
  });
});

test("tinybird.listInfinite accepts React Query's own paging direction", async () => {
  const caller = callerForWorkspace(1);

  // `@trpc/tanstack-react-query` puts `direction: "forward" | "backward"` on
  // every infinite-query input; rejecting it breaks the very first page load.
  for (const direction of ["forward", "backward"] as const) {
    const result = await caller.tinybird.listInfinite({
      monitorId: 1,
      limit: 50,
      direction,
    });
    expect(result).toEqual({ data: [], nextCursor: null, prevCursor: null });
  }
});
