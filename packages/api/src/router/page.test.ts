import { expect, test, vi } from "vitest";

import { edgeRouter } from "../edge";
import { createTRPCContext } from "../trpc";

vi.mock("@clerk/nextjs/server");
test("Get Test Page", async () => {
  const ctx = await createTRPCContext({
    req: {},
  });

  // @ts-expect-error
  ctx.auth = {
    userId: "1",
    sessionId: "1",
  };

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.page.getPageBySlug({ slug: "status" });
  expect(result).toMatchObject({
    createdAt: expect.any(Date),
    customDomain: "",
    description: "hello",
    icon: "https://www.openstatus.dev/favicon.ico",
    incidents: [],
    monitors: [
      {
        active: true,
        createdAt: expect.any(Date),
        description: "description",
        id: 1,
        jobType: "other",
        name: "OpenStatus",
        periodicity: "1m",
        status: "inactive",
        updatedAt: expect.any(Date),
        url: "https://www.openstatus.dev",
        workspaceId: null,
      },
    ],
    published: false,
    slug: "status",
    title: "Test Page",
    updatedAt: expect.any(Date),
  });
});

test("No Page", async () => {
  const ctx = await createTRPCContext({
    req: {},
  });

  // @ts-expect-error
  ctx.auth = {
    userId: "1",
    sessionId: "1",
  };

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.page.getPageBySlug({ slug: "Dont Exist" });
  expect(result).toBeUndefined();
});
