import { expect, test } from "bun:test";
import { z } from "@hono/zod-openapi";

import { app } from "@/index";
import { SummarySchema } from "./schema";

test("return the summary of the monitor", async () => {
  const res = await app.request("/v1/monitor/1/summary", {
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = z
    .object({ data: SummarySchema.array() })
    .safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/summary");

  expect(res.status).toBe(401);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/404/summary", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
