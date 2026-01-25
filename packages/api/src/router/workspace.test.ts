import { expect, test } from "bun:test";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

test("Get Test Workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: {
      user: {
        id: "1",
      },
    },
    //@ts-expect-error
    workspace: {
      id: 1,
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getWorkspace();

  expect(result).toMatchObject({
    id: 1,
    slug: "love-openstatus",
    name: "test",
    plan: "team",
    paidUntil: null,
    stripeId: "stripeId1",
    subscriptionId: "subscriptionId",
    updatedAt: expect.any(Date),
    createdAt: expect.any(Date),
    endsAt: null,
  });
});

test("by default we get the first workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: {
      user: {
        // @ts-expect-error some issues with types
        id: 1,
      },
    },
    workspace: undefined,
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getWorkspace();

  expect(result).toMatchObject({
    id: 1,
    slug: "love-openstatus",
    name: "test",
    plan: "team",
    paidUntil: null,
    stripeId: "stripeId1",
    subscriptionId: "subscriptionId",
    updatedAt: expect.any(Date),
    createdAt: expect.any(Date),
    endsAt: null,
  });
});
