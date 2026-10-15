import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

function caller(userId: number, workspaceId: number) {
  return edgeRouter.createCaller(
    createInnerTRPCContext({
      req: undefined,
      session: { user: { id: String(userId) } },
      // @ts-expect-error - minimal user for test
      user: { id: userId },
      // @ts-expect-error - minimal workspace for test
      workspace: { id: workspaceId },
    }),
  );
}

test("hasSubmitted turns true once the user answered that source", async () => {
  const f = await createTestWorkspace();
  const other = await createTestWorkspace();
  const own = caller(f.user.id, f.workspace.id);
  const source = "upgrade-intent" as const;

  expect(await own.feedback.hasSubmitted({ source })).toBe(false);

  await own.feedback.submit({
    source,
    message: "A status page for our API",
    path: "/settings/billing",
  });

  expect(await own.feedback.hasSubmitted({ source })).toBe(true);
  expect(await own.feedback.hasSubmitted({ source: "onboarding-source" })).toBe(
    false,
  );
  expect(
    await caller(other.user.id, other.workspace.id).feedback.hasSubmitted({
      source,
    }),
  ).toBe(false);
});
