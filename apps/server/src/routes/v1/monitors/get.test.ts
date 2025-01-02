import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("return the monitor", async () => {
  const res = await app.request("/v1/monitor/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = MonitorSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/2");

  expect(res.status).toBe(401);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/2", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
