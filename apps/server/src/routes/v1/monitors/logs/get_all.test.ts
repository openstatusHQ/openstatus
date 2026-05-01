import { expect, test } from "bun:test";

import { app } from "@/index";
import { ResponseLogListItem } from "../schema";

test("get monitor logs with valid id should return 200", async () => {
  const res = await app.request("/v1/monitor/1/logs", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = ResponseLogListItem.array().safeParse(json.data);
  expect(result.success).toBe(true);
  expect(json.pagination).toEqual({
    limit: 25,
    offset: 0,
    hasMore: false,
    nextOffset: null,
  });
});

test("get monitor logs supports date filters and pagination", async () => {
  const res = await app.request(
    "/v1/monitor/1/logs?from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-02T00%3A00%3A00.000Z&limit=10&offset=20",
    {
      method: "GET",
      headers: {
        "x-openstatus-key": "1",
      },
    },
  );

  expect(res.status).toBe(200);

  const json = await res.json();
  expect(json.pagination).toEqual({
    limit: 10,
    offset: 20,
    hasMore: false,
    nextOffset: null,
  });
});

test("get monitor logs rejects invalid pagination", async () => {
  const res = await app.request("/v1/monitor/1/logs?limit=101", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(400);
});

test("get monitor logs with invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/999999/logs", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("get monitor logs without auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/logs", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});

test("get monitor logs from different workspace should return 404", async () => {
  const res = await app.request("/v1/monitor/5/logs", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});
