import { expect, test } from "bun:test";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

test("Get Test Page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error
    auth: {
      userId: "1",
      sessionId: "1",
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.statusPage.getLight({ slug: "status" });
  expect(result).toMatchObject({
    createdAt: expect.any(Date),
    customDomain: expect.any(String),
    description: expect.any(String),
    icon: expect.any(String),
    statusReports: expect.any(Array),
    monitors: expect.any(Array),
    incidents: expect.any(Array),
    maintenances: expect.any(Array),
    published: expect.any(Boolean),
    slug: expect.any(String),
    title: expect.any(String),
    updatedAt: expect.any(Date),
    // NEW: Verify pageComponents and pageComponentGroups are present
    pageComponents: expect.any(Array),
    pageComponentGroups: expect.any(Array),
  });
});

test("No Page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error
    auth: {
      userId: "1",
      sessionId: "1",
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.statusPage.getLight({ slug: "Dont Exist" });
  expect(result).toBeNull();
});

test("Page Components Architecture", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error
    auth: {
      userId: "1",
      sessionId: "1",
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.statusPage.getLight({ slug: "status" });

  if (!result) {
    throw new Error("Expected page to exist");
  }

  // Verify pageComponents field is present and populated
  expect(result.pageComponents).toBeDefined();
  expect(Array.isArray(result.pageComponents)).toBe(true);

  // Verify pageComponentGroups field is present
  expect(result.pageComponentGroups).toBeDefined();
  expect(Array.isArray(result.pageComponentGroups)).toBe(true);

  // Verify backwards compatibility: monitors array matches monitor-type pageComponents
  const monitorTypeComponents = result.pageComponents.filter(
    (c) => c.type === "monitor" && c.monitor,
  );

  expect(result.monitors.length).toBe(monitorTypeComponents.length);

  // Verify sorting is preserved (by order field)
  for (let i = 0; i < result.monitors.length - 1; i++) {
    const currentMonitor = result.monitors[i];
    const nextMonitor = result.monitors[i + 1];

    const currentComponent = monitorTypeComponents.find(
      (c) => c.monitor?.id === currentMonitor.id,
    );
    const nextComponent = monitorTypeComponents.find(
      (c) => c.monitor?.id === nextMonitor.id,
    );

    expect(currentComponent).toBeDefined();
    expect(nextComponent).toBeDefined();

    if (currentComponent && nextComponent) {
      expect(currentComponent.order).toBeLessThanOrEqual(nextComponent.order);
    }
  }
});
