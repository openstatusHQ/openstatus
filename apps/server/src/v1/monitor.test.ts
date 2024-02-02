import { expect, test } from "bun:test";

import { api } from ".";

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
  // console.log(await res.text());
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

test("Update a Monitor ", async () => {
  const data = {
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    name: "OpenStatus",
    description: "OpenStatus website",
    regions: ["ams"],
    method: "PUT",
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
    id: expect.any(Number),
    periodicity: "10m",
    url: "https://www.openstatus.dev",
    regions: ["ams"],
    name: "OpenStatus",
    description: "OpenStatus website",
    method: "PUT",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
    active: true,
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
    message: "Deleted"
  });
});

test("Get monitor daily Summary", async () => {
  const res = await api.request("/monitor/1/summary", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
      ok: 4,
      count: 13,
      avgLatency: 1,
      day: "31-01-2024"
  });
});


