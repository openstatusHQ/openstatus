import { expect, test } from "bun:test";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

test("Get Test Workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error some issues with types
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
    plan: "pro",
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
    // @ts-expect-error some issues with types
    session: {
      user: {
        id: "1",
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
    plan: "pro",
    paidUntil: null,
    stripeId: "stripeId1",
    subscriptionId: "subscriptionId",
    updatedAt: expect.any(Date),
    createdAt: expect.any(Date),
    endsAt: null,
  });
});

test("All workspaces", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    // @ts-expect-error some issues with types
    session: {
      user: {
        id: "1",
      },
    },
  });

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getUserWithWorkspace();
  expect(result).toMatchObject([
    {
      createdAt: expect.any(Date),
      email: "ping@openstatus.dev",
      firstName: "Speed",
      id: 1,
      lastName: "Matters",
      photoUrl: "",
      tenantId: "1",
      updatedAt: expect.any(Date),
      usersToWorkspaces: [
        {
          userId: 1,
          workspace: {
            createdAt: expect.any(Date),
            endsAt: null,
            id: 1,
            name: "test",
            paidUntil: null,
            plan: "pro",
            slug: "love-openstatus",
            stripeId: "stripeId1",
            subscriptionId: "subscriptionId",
            updatedAt: expect.any(Date),
          },
          workspaceId: 1,
        },
      ],
    },
  ]);
});
