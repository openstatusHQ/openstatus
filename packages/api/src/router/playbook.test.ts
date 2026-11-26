import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect, test } from "vitest";

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

test("a variable's value survives save, a value-only save and a reload", async () => {
  const f = await createTestWorkspace();
  const own = caller(f.user.id, f.workspace.id);
  const content = "Contact {{support}} first.";

  await own.playbook.save({
    slug: "maintenance-windows",
    content,
    variables: { support: "the support desk" },
  });
  expect(
    (await own.playbook.get({ slug: "maintenance-windows" }))?.variables,
  ).toEqual({ support: "the support desk" });

  await own.playbook.save({
    slug: "maintenance-windows",
    content,
    variables: { support: "help@acme.com" },
  });
  const reloaded = await own.playbook.get({ slug: "maintenance-windows" });
  expect(reloaded?.variables).toEqual({ support: "help@acme.com" });
  expect(reloaded?.content).toBe(content);
  expect(reloaded?.createdByUser?.id).toBe(f.user.id);

  await own.playbook.clear({ slug: "maintenance-windows" });
  expect(await own.playbook.get({ slug: "maintenance-windows" })).toBeNull();
});
