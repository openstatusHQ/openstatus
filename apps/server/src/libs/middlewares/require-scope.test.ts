import type { Scope } from "@openstatus/db/src/schema";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import type { Variables } from "@/types";

import { requireGroupScope } from "./require-scope";

/**
 * Mirrors the V1 router: `apiKey` is pre-populated (as `authMiddleware`
 * would), the middleware is mounted on `/<resource>/*` before the
 * sub-router is attached, and requests go through a real `app.request`.
 */
function makeApp(scopes: Scope[] | undefined): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    if (scopes !== undefined) {
      c.set("apiKey", { id: "test-key", createdById: 1, scopes });
    }
    await next();
  });
  app.use("/monitor/*", requireGroupScope("monitors"));
  app.use("/page/*", requireGroupScope("pages"));
  app.use("/page_subscriber/*", requireGroupScope("subscribers"));
  app.use("/whoami/*", requireGroupScope("any"));

  const crud = () => {
    const sub = new Hono<{ Variables: Variables }>();
    sub.get("/", (c) => c.text("ok-list"));
    sub.get("/:id", (c) => c.text("ok-get"));
    sub.post("/", (c) => c.text("ok-post"));
    sub.put("/:id", (c) => c.text("ok-put"));
    sub.delete("/:id", (c) => c.text("ok-delete"));
    return sub;
  };
  app.route("/monitor", crud());
  app.route("/page", crud());
  app.route("/page_subscriber", crud());
  const whoami = new Hono<{ Variables: Variables }>();
  whoami.get("/", (c) => c.text("ok-whoami"));
  app.route("/whoami", whoami);
  return app;
}

async function status(
  scopes: Scope[] | undefined,
  method: string,
  path: string,
): Promise<number> {
  const res = await makeApp(scopes).request(path, { method });
  return res.status;
}

describe("requireGroupScope", () => {
  test("legacy read key passes GET and HEAD, including the sub-router root", async () => {
    expect(await status(["read"], "GET", "/monitor")).toBe(200);
    expect(await status(["read"], "GET", "/monitor/1")).toBe(200);
    expect(await status(["read"], "HEAD", "/monitor/1")).toBe(200);
    expect(await status(["read"], "GET", "/page")).toBe(200);
  });

  test("legacy read key is refused every mutating method", async () => {
    expect(await status(["read"], "POST", "/monitor")).toBe(403);
    expect(await status(["read"], "PUT", "/monitor/1")).toBe(403);
    expect(await status(["read"], "DELETE", "/monitor/1")).toBe(403);
  });

  test("legacy write key passes everything, subscribers included", async () => {
    expect(await status(["write"], "POST", "/monitor")).toBe(200);
    expect(await status(["write"], "DELETE", "/page/1")).toBe(200);
    expect(await status(["write"], "GET", "/page_subscriber")).toBe(200);
    expect(await status(["write"], "POST", "/page_subscriber")).toBe(200);
    expect(await status(["write"], "GET", "/whoami")).toBe(200);
  });

  test("group write key covers its own group's reads and writes only", async () => {
    expect(await status(["monitors:write"], "GET", "/monitor/1")).toBe(200);
    expect(await status(["monitors:write"], "POST", "/monitor")).toBe(200);
    expect(await status(["monitors:write"], "GET", "/page")).toBe(403);
    expect(await status(["pages:write"], "POST", "/monitor")).toBe(403);
    expect(await status(["pages:write"], "POST", "/page")).toBe(200);
  });

  test("group read key cannot write its own group", async () => {
    expect(await status(["monitors:read"], "GET", "/monitor")).toBe(200);
    expect(await status(["monitors:read"], "POST", "/monitor")).toBe(403);
  });

  test("subscribers:read reaches subscriber reads only; legacy read does too", async () => {
    expect(await status(["read"], "GET", "/page_subscriber")).toBe(200);
    expect(await status(["subscribers:read"], "GET", "/page_subscriber")).toBe(
      200,
    );
    expect(await status(["subscribers:read"], "POST", "/page_subscriber")).toBe(
      403,
    );
    expect(await status(["subscribers:read"], "GET", "/monitor")).toBe(403);
  });

  test("'any' accepts every non-empty key and refuses an empty one", async () => {
    expect(await status(["monitors:read"], "GET", "/whoami")).toBe(200);
    expect(await status(["subscribers:read"], "GET", "/whoami")).toBe(200);
    expect(await status([], "GET", "/whoami")).toBe(403);
  });

  test("super-admin '*' key passes everything", async () => {
    expect(await status(["*"], "POST", "/monitor")).toBe(200);
    expect(await status(["*"], "GET", "/page_subscriber")).toBe(200);
  });

  test("empty scopes fail closed on reads and writes", async () => {
    expect(await status([], "GET", "/monitor")).toBe(403);
    expect(await status([], "POST", "/monitor")).toBe(403);
  });

  test("403 names the scope the request needed", async () => {
    const res = await makeApp(["read"]).request("/monitor", {
      method: "POST",
    });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("monitors:write");
  });

  test("missing apiKey defers to upstream (no 403, would be 401 in prod)", async () => {
    expect(await status(undefined, "POST", "/monitor")).toBe(200);
  });
});
