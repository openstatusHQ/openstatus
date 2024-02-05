import { expect, test } from "bun:test";

import { api } from ".";

test("GET one status report update ", async () => {
  const res = await api.request("/status_report_update/1", {
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

test("create one status report update ", async () => {
  const res = await api.request("/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      message: "test",
      status_report_id: 1,
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "investigating",
    message: "test",
  });
});

test("create one status report update without auth key should return 401", async () => {
  const res = await api.request("/status_report_update", {
    method: "POST",
    headers: {
      //not passing in the key
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      message: "test",
      status_report_id: 1,
    }),
  });
  expect(res.status).toBe(401);
});

test("create one status report update with invalid data should return 403", async () => {
  const res = await api.request("/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      //incompelete body
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
    }),
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
