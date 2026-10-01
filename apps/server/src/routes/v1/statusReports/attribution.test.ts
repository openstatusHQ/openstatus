import { OpenAPIHono } from "@hono/zod-openapi";
import { db, eq } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { lookupWorkspace } from "@/libs/middlewares/auth";

import type { Variables } from "../index";
import { statusReportsApi } from "./index";

/** The v1 router with `authMiddleware` replaced by a fixed key identity. */
function makeApp(createdById: number | undefined) {
  const app = new OpenAPIHono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("workspace", await lookupWorkspace(1));
    c.set("apiKey", { id: "test-key", createdById, scopes: ["write"] });
    await next();
  });
  app.route("/", statusReportsApi);
  return app;
}

async function post(createdById: number | undefined, title: string) {
  const res = await makeApp(createdById).request("/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "investigating",
      title,
      message: "m",
      monitorIds: [],
      date: new Date().toISOString(),
      pageId: 1,
    }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { id: number };
  return body.id;
}

test("v1 status report stamps the key's creator", async () => {
  const id = await post(1, "v1-attribution-user");
  try {
    const report = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, id))
      .get();
    expect(report?.createdBy).toBe(1);
    expect(report?.updatedBy).toBe(1);
    const updates = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, id))
      .all();
    expect(updates.map((u) => [u.createdBy, u.updatedBy])).toEqual([[1, 1]]);
  } finally {
    await db.delete(statusReport).where(eq(statusReport.id, id));
  }
});

test("v1 status report leaves NULL for a key without a creator", async () => {
  const id = await post(undefined, "v1-attribution-anon");
  try {
    const report = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, id))
      .get();
    expect(report?.createdBy).toBeNull();
    expect(report?.updatedBy).toBeNull();
    const updates = await db
      .select()
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, id))
      .all();
    expect(updates.map((u) => [u.createdBy, u.updatedBy])).toEqual([
      [null, null],
    ]);
  } finally {
    await db.delete(statusReport).where(eq(statusReport.id, id));
  }
});
