import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("create a valid monitor", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      periodicity: "10m",
      url: "https://www.openstatus.dev",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      method: "POST",
      body: '{"hello":"world"}',
      headers: [{ key: "key", value: "value" }],
      active: true,
      public: true,
      assertions: [
        {
          type: "status",
          compare: "eq",
          target: 200,
        },
        { type: "header", compare: "not_eq", key: "key", target: "value" },
      ],
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a status report with invalid payload should return 400", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      periodicity: 32, //not valid value
      url: "https://www.openstatus.dev",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      method: "POST",
      body: '{"hello":"world"}',
      headers: [{ key: "key", value: "value" }],
      active: true,
      public: false,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a monitor with invalid page id should return 400", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      pageId: 404,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
