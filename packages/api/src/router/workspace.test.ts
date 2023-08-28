import { expect, test, vi } from "vitest";

import { edgeRouter } from "../edge";
import { createTRPCContext } from "../trpc";

vi.mock("@clerk/nextjs/server");
test("Get Test Workspace", async () => {
  const ctx = await createTRPCContext({
    req: {},
  });

  // @ts-expect-error
  ctx.auth = {
    userId: "1",
    sessionId: "1",
  };

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getWorkspace({ slug: "test" });
  expect(result).toEqual({
    id: 1,
    slug: "test",
    name: "test",
    plan: "free",
    paidUntil: null,
    stripeId: "stripeId",
    subscriptionId: "subscriptionId",
    updatedAt: expect.any(Date),
    createdAt: expect.any(Date),
    endsAt: null,
  });
});

test("No workspace", async () => {
  const ctx = createTRPCContext({
    req: {},
  });

  // @ts-expect-error
  ctx.auth = {
    userId: "1",
    sessionId: "1",
  };

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getWorkspace({ slug: "Dont Exist" });
  expect(result).toBeUndefined();
});

test("All workspaces", async () => {
  const ctx = createTRPCContext({
    req: {},
  });

  // @ts-expect-error
  ctx.auth = {
    userId: "1",
    sessionId: "1",
  };

  const caller = edgeRouter.createCaller(ctx);
  const result = await caller.workspace.getUserWithWorkspace();
  expect(result).toMatchObject([
    {
      createdAt: expect.any(Date),
      email: "test@test.com",
      firstName: "test",
      id: 1,
      lastName: "user",
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
            plan: "free",
            slug: "test",
            stripeId: "stripeId",
            subscriptionId: "subscriptionId",
            updatedAt: expect.any(Date),
          },
          workspaceId: 1,
        },
      ],
    },
  ]);
});
