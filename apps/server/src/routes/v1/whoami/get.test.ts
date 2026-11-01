import { OpenAPIHono } from "@hono/zod-openapi";
import type { Scope } from "@openstatus/db/src/schema/api-keys/constants";
import { expect, test } from "vitest";

import { app } from "@/index";
import { lookupWorkspace } from "@/libs/middlewares/auth";

import type { Variables } from "../index";
import { whoamiApi } from "./index";
import { WorkspaceSchema } from "./schema";

function makeApp(scopes: Scope[]) {
  const scoped = new OpenAPIHono<{ Variables: Variables }>();
  scoped.use("*", async (c, next) => {
    c.set("workspace", await lookupWorkspace(1));
    c.set("apiKey", { id: "test-key", createdById: undefined, scopes });
    await next();
  });
  scoped.route("/", whoamiApi);
  return scoped;
}

test("return the whoami", async () => {
  const res = await app.request("/v1/whoami", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = WorkspaceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/whoami");

  expect(res.status).toBe(401);
});

test("echoes group scopes and hides '*'", async () => {
  const res = await makeApp(["monitors:read", "pages:write", "*"]).request("/");
  expect(res.status).toBe(200);
  const result = WorkspaceSchema.parse(await res.json());
  expect(result.actor.scopes).toEqual(["monitors:read", "pages:write"]);
});
