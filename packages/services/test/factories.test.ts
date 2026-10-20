import { db, eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";
import { createWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

test("workspace fixtures recover from a wrapped database lock without duplicate rows", async () => {
  const slug = `test-ws-${crypto.randomUUID()}`;
  const execute = db.$client.execute.bind(db.$client);
  let busy = true;
  using query = stub(db.$client, "execute", (...args) => {
    if (busy) {
      busy = false;
      return Promise.reject(
        Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" }),
      );
    }
    return execute(...args);
  });

  try {
    const created = await createWorkspace({ slug, name: "Retry fixture" });
    const rows = await db
      .select({ id: workspace.id, name: workspace.name })
      .from(workspace)
      .where(eq(workspace.slug, slug));
    expect(rows).toEqual([{ id: created.id, name: "Retry fixture" }]);
  } finally {
    await db.delete(workspace).where(eq(workspace.slug, slug));
  }
});
