import { expect, test } from "bun:test";

import { app } from "@/index";

test("get monitor log with missing log id should return 404", async () => {
  const res = await app.request("/v1/monitor/1/logs/missing-log-id", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("get monitor log with invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/999999/logs/missing-log-id", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("get monitor log without auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/logs/missing-log-id", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});

test("get monitor log from different workspace should return 404", async () => {
  const res = await app.request("/v1/monitor/5/logs/missing-log-id", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});
