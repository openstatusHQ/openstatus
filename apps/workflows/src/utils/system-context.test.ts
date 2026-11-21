import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect, test } from "vitest";

import { systemContext } from "./system-context";

test("loads the workspace and acts as the named system job", async () => {
  const { workspace } = await createTestWorkspace();

  const ctx = await systemContext(workspace.id, "checker");

  expect(ctx.workspace.id).toBe(workspace.id);
  expect(ctx.workspace.slug).toBe(workspace.slug);
  expect(ctx.workspace.limits).toBeDefined();
  expect(ctx.actor).toEqual({ type: "system", job: "checker" });
});

test("throws when the monitor has no workspace", async () => {
  await expect(systemContext(null, "checker")).rejects.toThrow(
    "workspace null not found",
  );
});

test("throws when the workspace is gone", async () => {
  await expect(systemContext(-1, "checker")).rejects.toThrow(
    "workspace -1 not found",
  );
});
