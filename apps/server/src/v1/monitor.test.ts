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
    regions: "ams",
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

  expect(await res.json()).toMatchObject([
    {
      id: 1,
      periodicity: "1m",
      url: "https://www.openstatus.dev",
      regions: "ams",
      name: "OpenStatus",
      description: "OpenStatus website",
      method: "POST",
      body: '{"hello":"world"}',
      headers: [{ key: "key", value: "value" }],
      active: true,
    },
    {
      active: false,
      body: "",
      description: "",
      headers: [],
      id: 2,
      method: "GET",
      name: "",
      periodicity: "10m",
      regions: "gru",
      url: "https://www.google.com",
    },
  ]);
});
