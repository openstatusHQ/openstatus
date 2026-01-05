import { expect, test } from "bun:test";

import { createInnerTRPCContext } from "../trpc";
import { appRouter } from "../root";
import { TRPCError } from "@trpc/server";
import { flyRegions } from "@openstatus/db/src/schema/constants";

function getTestContext(limits?: unknown) {
  return createInnerTRPCContext({
    req: undefined,
    session: {
      user: {
        id: "1",
      },
    },
    workspace: {
      id: 1,
      // @ts-expect-error
      limits: limits || {
        monitors: 10,
        periodicity: ["1m"],
        regions: ["fra"],
      },
    },
  });
}

const monitorData = {
  name: "Test Monitor",
  url: "https://example.com",
  jobType: "http" as const,
  method: "GET" as const,
  periodicity: "1m" as const,
  regions: [flyRegions[0]],
  statusAssertions: [],
  headerAssertions: [],
  textBodyAssertions: [],
  notifications: [],
  pages: [],
  tags: [],
};

test("Create Monitor", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMonitor = await caller.monitor.create(monitorData);

  expect(createdMonitor).toMatchObject({
    id: expect.any(Number),
    name: "Test Monitor",
    url: "https://example.com",
    workspaceId: 1,
  });
});

test("Get Monitor by ID", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMonitor = await caller.monitor.create(monitorData);
  const monitorId = createdMonitor.id;

  const fetchedMonitor = await caller.monitor.get({
    id: monitorId,
  });

  expect(fetchedMonitor).not.toBeNull();
  expect(fetchedMonitor).toMatchObject({
    id: monitorId,
    name: "Test Monitor",
    url: "https://example.com",
  });
});

test("Update Monitor", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMonitor = await caller.monitor.create(monitorData);
  const monitorId = createdMonitor.id;

  await caller.monitor.update({
    ...monitorData,
    id: monitorId,
    name: "Updated Test Monitor",
  });

  const updatedMonitor = await caller.monitor.get({
    id: monitorId,
  });

  expect(updatedMonitor).not.toBeNull();
  expect(updatedMonitor?.name).toBe("Updated Test Monitor");
});

test("Delete Monitor", async () => {
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);

  const createdMonitor = await caller.monitor.create(monitorData);
  const monitorId = createdMonitor.id;

  await caller.monitor.delete({
    id: monitorId,
  });

  const fetchedMonitor = await caller.monitor.get({
    id: monitorId,
  });
  expect(fetchedMonitor).toBeNull();
});

test.todo("Monitor Limit Reached", async () => {
  const ctx = getTestContext();
  // @ts-expect-error
  ctx.workspace.limits.monitors = 1;
  const caller = appRouter.createCaller(ctx);

  await caller.monitor.create(monitorData);

  await caller.monitor.create(monitorData);

  await expect(await caller.monitor.create(monitorData)).rejects.toThrow(
    new TRPCError({
      code: "FORBIDDEN",
      message: "You reached your monitor limits.",
    }),
  );
});
