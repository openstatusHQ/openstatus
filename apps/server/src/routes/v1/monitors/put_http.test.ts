import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("update the monitor", async () => {
  const res = await app.request("/v1/monitor/http/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "New Name",
    }),
  });

  expect(res.status).toBe(400);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/http/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        url: "https://www.openstatus.dev",
        method: "POST",
        body: '{"hello":"world"}',
        headers: { "content-type": "application/json" },
      },
      active: true,
      public: true,
      assertions: [
        {
          kind: "statusCode",
          compare: "eq",
          target: 200,
        },
        { kind: "header", compare: "not_eq", key: "key", target: "value" },
      ],
    }),
  });

  expect(res.status).toBe(404);
});

test("Update a valid monitor", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        url: "https://www.openstatus.dev",
        method: "POST",
        body: '{"hello":"world"}',
        headers: { "content-type": "application/json" },
      },
      active: true,
      public: true,
      assertions: [
        {
          kind: "statusCode",
          compare: "eq",
          target: 200,
        },
        { kind: "header", compare: "not_eq", key: "key", target: "value" },
      ],
    }),
  });

  const result = MonitorSchema.parse(await res.json());

  expect(res.status).toBe(200);

  const updated = await app.request(`/v1/monitor/http/${result.id}`, {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "30m",
      name: "newName",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        url: "https://www.openstatus.dev",
        method: "POST",
        body: '{"hello":"world"}',
        headers: { "content-type": "application/json" },
      },
      active: true,
      public: true,
    }),

    // expect(r.success).toBe(true);
  });
  const r = MonitorSchema.parse(await updated.json());
  expect(r.assertions?.length).toBe(0);
  expect(r.periodicity).toBe("30m");
  expect(r.name).toBe("newName");
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/http/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      /* */
    }),
  });

  expect(res.status).toBe(401);
});
