import { expect, test } from "bun:test";

import { app } from "@/index";
import { ResultRun } from "../schema";

test("get monitor result with valid id should return 200", async () => {
  const res = await app.request("/v1/monitor/1/result/1", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = ResultRun.array().safeParse(json);
  expect(result.success).toBe(true);
});

test("get monitor result with invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/999999/result/1", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("get monitor result with invalid result id should return 404", async () => {
  const res = await app.request("/v1/monitor/1/result/999999", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("get monitor result without auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/result/1", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});

test("get monitor result from different workspace should return 404", async () => {
  const res = await app.request("/v1/monitor/2/result/1", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});
