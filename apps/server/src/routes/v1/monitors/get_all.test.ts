import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("return all monitors", async () => {
  const res = await app.request("/v1/monitor", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = MonitorSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.length).toBeGreaterThan(0);
});

test("return empty monitors", async () => {
  const res = await app.request("/v1/monitor", {
    method: "GET",
    headers: {
      "x-openstatus-key": "2",
    },
  });

  const result = MonitorSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
