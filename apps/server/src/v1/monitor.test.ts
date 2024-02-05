import { expect, test } from "bun:test";
import { api } from ".";

const iso8601Regex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

test("GET one monitor", async () => {
  const res = await api.request("/monitor/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
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
  });
});

test("GET all monitor", async () => {
  const res = await api.request("/monitor", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect((await res.json())[0]).toMatchObject({
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
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    regions: ["ams", "gru"],
    name: "OpenStatus",
    description: "OpenStatus website",
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
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
  expect(await res.json()).toMatchObject({
    error: {
      issues: expect.any(Array),
      name: "ZodError",
    },
    success: false,
  });
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
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    code: 404,
    message: "Not Found",
  });
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
  expect(await res.json()).toMatchObject({
    error: {
      issues: expect.any(Array),
      name: "ZodError",
    },
    success: false,
  });
});

test("Delete one monitor", async () => {
  const res = await api.request("/monitor/3", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    message: "Deleted",
  });
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
