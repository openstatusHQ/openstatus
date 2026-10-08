import { OpenAPIHono } from "@hono/zod-openapi";
import { db, eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { lookupWorkspace } from "@/libs/middlewares/auth";

import type { Variables } from "../index";
import { maintenancesApi } from "./index";

/** The v1 router with `authMiddleware` replaced by a fixed key identity. */
function makeApp(createdById: number | undefined) {
  const app = new OpenAPIHono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("workspace", await lookupWorkspace(1));
    c.set("apiKey", { id: "test-key", createdById, scopes: ["write"] });
    await next();
  });
  app.route("/", maintenancesApi);
  return app;
}

test("v1 maintenance stamps the key's creator on create and update", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);
  const created = await makeApp(1).request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "v1-attribution",
      message: "m",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });
  let id: number | undefined;
  try {
    expect(created.status).toBe(200);
    id = ((await created.json()) as { id: number }).id;
    let row = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, id))
      .get();
    expect(row?.createdBy).toBe(1);
    expect(row?.updatedBy).toBe(1);

    // a second key without a creator edits it: updated_by clears, created_by stays
    const updated = await makeApp(undefined).request(`/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "v1-attribution-renamed" }),
    });
    expect(updated.status).toBe(200);
    row = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, id))
      .get();
    expect(row?.createdBy).toBe(1);
    expect(row?.updatedBy).toBeNull();
  } finally {
    if (id !== undefined) {
      await db.delete(maintenance).where(eq(maintenance.id, id));
    }
  }
});
