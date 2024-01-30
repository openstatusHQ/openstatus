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

