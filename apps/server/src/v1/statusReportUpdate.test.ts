import { expect, test } from "bun:test";

import { api } from ".";

test("GET one incident update ", async () => {
  const res = await api.request("/status_update/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "investigating",
    message: "test",
  });
});

test("create one incident update ", async () => {
  const res = await api.request("/status_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      message: "test",
      incident_id: 1,
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "investigating",
    message: "test",
  });
});
