import { expect, test } from "bun:test";

import { api } from "../index";
import type { MonitorSchema } from "./schema";

test("GET one monitor", async () => {
  const res = await api.request("/monitor/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json).toMatchObject({
    id: 1,
    periodicity: "1m",
    url: "https://www.openstatus.dev",
    regions: ["ams"],
    name: "OpenStatus",
    description: "OpenStatus website",
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
    assertions: null,
  });
});

test("GET all monitor", async () => {
  const res = await api.request("/monitor", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const json = (await res.json()) as MonitorSchema[];

  expect(res.status).toBe(200);
  expect(json[0]).toMatchObject({
    id: 1,
    periodicity: "1m",
    url: "https://www.openstatus.dev",
    regions: ["ams"],
    name: "OpenStatus",
    description: "OpenStatus website",
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
  });
});

test("Create a monitor", async () => {
  const data = {
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
        target: "200",
      },
      { type: "header", compare: "not_eq", key: "key", target: "value" },
    ],
  };

  const res = await api.request("/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    ...data,
  });
});

test("Create a monitor with Assertion ", async () => {
  const data = {
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams", "gru", "iad"],
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: true,
    assertions: [
      {
        type: "status",
        compare: "eq",
        target: "200",
      },
      { type: "header", compare: "not_eq", key: "key", target: "value" },
    ],
  };
  const res = await api.request("/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    ...data,
  });
});

test("Create a monitor without auth key should return 401", async () => {
  const data = {
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams", "gru"],
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
  };
  const res = await api.request("/monitor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  expect(res.status).toBe(401);
});

test("Create a monitor with invalid data should return 403", async () => {
  const data = {
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
  };
  const res = await api.request("/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(400);
});

test("Update a Monitor ", async () => {
  const data = {
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams"],
    method: "GET",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: true,
  };

  const res = await api.request("/monitor/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: 1,
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    regions: ["ams"],
    name: "OpenStatus",
    description: "OpenStatus website",
    method: "GET",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: true,
  });
});

test("Update a monitor not in db should return 404", async () => {
  const data = {
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams"],
    method: "GET",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
  };

  const res = await api.request("/monitor/404", {
    //accessing wrong monitor, just returns 404
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  expect(res.status).toBe(404);
});

test("Update a monitor without auth key should return 401", async () => {
  const data = {
    periodicity: "5m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams"],
    method: "GET",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
  };
  const res = await api.request("/monitor/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  expect(res.status).toBe(401);
});
test("Update a monitor with invalid data should return 403", async () => {
  const data = {
    periodicity: 9, //not passing correct value returns 403
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams"],
    method: "GET",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
    public: false,
  };
  const res = await api.request("/monitor/2", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(400);
});

test("Delete one monitor", async () => {
  const res = await api.request("/monitor/3", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({});
});

test.todo("Get monitor daily Summary");
// test("Get monitor daily Summary", async () => {
//   const res = await api.request("/monitor/1/summary", {
//     headers: {
//       "x-openstatus-key": "1",
//     },
//   });
//   expect(res.status).toBe(200);
//   expect(await res.json()).toMatchObject({
//       ok: 4,
//       count: 13,
//       avgLatency: 1,
//       day: expect.stringMatching(iso8601Regex)
//   });
// });
