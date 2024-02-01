import { expect, test } from "bun:test";

import { api } from ".";

test("GET one status report", async () => {
  const res = await api.request("/status_report/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    // TODO: discuss if we should return `updates` instead of `status_report_updates`
    status_report_updates: expect.any(Array),
  });
});

test("create one status report", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Test Status Report",
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    status_report_updates: expect.any(Array)
  });
});

test("Get all status report", async () => {
  const res = await api.request("/status_report", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect((await res.json())[0]).toMatchObject({
    id: expect.any(Number),
    status_report_updates: expect.any(Array),
  });
});

test("Delete a status report", async () => {
  const res = await api.request("/status_report/1", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "investigating",
    id: 1,
    title: "Test Status Report",
    status_report_updates: expect.any(Array)
  });
});

test("create a status report update", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      message: "Test Status Report",
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "investigating",
    id: expect.any(String),
    date: "Wed Nov 08 2023 21:03:13 GMT+0000 (Coordinated Universal Time)",
    message: "Test Status Report"
  });
});

