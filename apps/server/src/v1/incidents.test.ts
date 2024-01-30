import { expect, test } from "bun:test";

import { api } from ".";

test("GET one Incident", async () => {
  const res = await api.request("/incident/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    status: "investigating",
    title: "Test Incident",
    // TODO: discuss if we should return `updates` instead of `incident_updates`
    incident_updates: expect.any(Array),
  });
});

test("create one Incident", async () => {
  const res = await api.request("/incident", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      title: "Test Incident",
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    status: "investigating",
    title: "Test Incident",
  });
});
