import { describe, expect, test } from "bun:test";

import type { Scope } from "@openstatus/db/src/schema";
import { Hono } from "hono";

import type { Variables } from "@/types";

import { requireWriteScope } from "./require-scope";

/**
 * Spin up a minimal Hono app, pre-populate `apiKey` (simulating
 * `authMiddleware` having already run), mount `requireWriteScope`,
 * and exercise it with a real `app.request`. Closer to the production
 * shape than calling the middleware function directly with a mock
 * context.
 */
function makeApp(scopes: Scope[] | undefined): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    if (scopes !== undefined) {
      c.set("apiKey", {
        id: "test-key",
        createdById: 1,
        scopes,
      });
    }
    await next();
  });
  app.use("*", requireWriteScope());
  app.get("/r", (c) => c.text("ok-get"));
  app.post("/r", (c) => c.text("ok-post"));
  app.put("/r", (c) => c.text("ok-put"));
  app.delete("/r", (c) => c.text("ok-delete"));
  return app;
}

describe("requireWriteScope", () => {
  test("GET passes for read-only key", async () => {
    const res = await makeApp(["read"]).request("/r", { method: "GET" });
    expect(res.status).toBe(200);
  });

  test("HEAD passes for read-only key", async () => {
    const res = await makeApp(["read"]).request("/r", { method: "HEAD" });
    expect(res.status).toBe(200);
  });

  test("POST returns 403 for read-only key", async () => {
    const res = await makeApp(["read"]).request("/r", { method: "POST" });
    expect(res.status).toBe(403);
  });

  test("PUT returns 403 for read-only key", async () => {
    const res = await makeApp(["read"]).request("/r", { method: "PUT" });
    expect(res.status).toBe(403);
  });

  test("DELETE returns 403 for read-only key", async () => {
    const res = await makeApp(["read"]).request("/r", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  test("POST passes for write key", async () => {
    const res = await makeApp(["write"]).request("/r", { method: "POST" });
    expect(res.status).toBe(200);
  });

  test("POST passes for super-admin '*' key", async () => {
    const res = await makeApp(["*"]).request("/r", { method: "POST" });
    expect(res.status).toBe(200);
  });

  test("POST returns 403 for empty scopes (fail-closed)", async () => {
    const res = await makeApp([]).request("/r", { method: "POST" });
    expect(res.status).toBe(403);
  });

  test("missing apiKey defers to upstream (no 403, would be 401 in prod)", async () => {
    // `requireWriteScope` is not the auth gate — when `apiKey` isn't
    // set, it must let the request flow on so `authMiddleware` (in
    // prod) can return its own 401 instead of this layer returning a
    // confusing 403.
    const res = await makeApp(undefined).request("/r", { method: "POST" });
    expect(res.status).toBe(200);
  });
});
