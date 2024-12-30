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
  const result = await caller.page.getPageBySlug({ slug: "status" });
  expect(result).toMatchObject({
    createdAt: expect.any(Date),
    customDomain: expect.any(String),
    description: expect.any(String),
    icon: expect.any(String),
    statusReports: expect.any(Array),
    monitors: expect.any(Array),
    incidents: expect.any(Array),
    published: expect.any(Boolean),
    slug: expect.any(String),
    title: expect.any(String),
    updatedAt: expect.any(Date),
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
  const result = await caller.page.getPageBySlug({ slug: "Dont Exist" });
  expect(result).toBeUndefined();
});
