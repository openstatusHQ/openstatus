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
    title: "Test Status Report",
    status: "monitoring",
    status_report_updates: [1, 3, 4],
    message: "test",
    monitors_id: null,
    pages_id: [1],
  });
});

test("Get all status report", async () => {
  const res = await api.request("/status_report", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect({ data: await res.json() }).toMatchObject({
    data: [
      {
        id: 1,
        title: "Test Status Report",
        status: "monitoring",
        status_report_updates: [1, 3, 4],
        message: "test",
        monitors_id: null,
        pages_id: [1],
      },
      {
        id: 2,
        title: "Test Status Report",
        status: "investigating",
        status_report_updates: [2],
        message: "Message",
        monitors_id: [1, 2],
        pages_id: [1],
      },
    ],
  });
});

test("Create one status report including passing optional fields", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitors_id: [1],
      pages_id: [1],
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 3,
    title: "New Status Report",
    status: "investigating",
    status_report_updates: [5],
    message: "Message",
    monitors_id: [1],
    pages_id: [1],
  });
});

test("Create one status report without auth key should return 401", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Test Status Report",
    }),
  });
  expect(res.status).toBe(401); //unauthenticated
});

test("Create one status report with invalid data should return 403", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      //passing incompelete body
      title: "Test Status Report",
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

test("Create status report with non existing monitor ids should return 400", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitors_id: [100],
      pages_id: [1],
    }),
  });

  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({
    code: 400,
    message: "monitor(s) with id [100] doesn't exist ",
  });
});

test("Create status report with non existing page ids should return 400", async () => {
  const res = await api.request("/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitors_id: [1],
      pages_id: [100],
    }),
  });

  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({
    code: 400,
    message: "page(s) with id [100] doesn't exist ",
  });
});

test("Delete a status report", async () => {
  const res = await api.request("/status_report/3", {
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
test("create a status report update with empty body should return current report info", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    title: "Test Status Report",
    status: "monitoring",
    status_report_updates: [1, 3],
    message: "test",
    monitors_id: null,
    pages_id: [1],
  });
});

test("Create status report update with non existing monitor ids should return 400", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitors_id: [100],
      pages_id: [1],
    }),
  });

  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({
    code: 400,
    message: "monitor(s) with id [100] doesn't exist ",
  });
});

test("Create status report update with non existing page ids should return 400", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitors_id: [1],
      pages_id: [100],
    }),
  });

  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({
    code: 400,
    message: "page(s) with id [100] doesn't exist ",
  });
});

test("Update with title, monitor & page should not create record in status_report_update table", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Doesn't add record",
      monitors_id: [1],
      pages_id: [],
    }),
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    title: "Doesn't add record",
    status: "monitoring",
    status_report_updates: [1, 3],
    message: "test",
    monitors_id: [1],
    pages_id: null,
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
      title: "Updated Status Report",
      status: "resolved",
      message: "New Message",
      monitors_id: [1, 2],
      pages_id: [],
    }),
  });
  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: 1,
    title: "Updated Status Report",
    status: "resolved",
    status_report_updates: [1, 3, 4],
    message: "New Message",
    monitors_id: [1, 2],
    pages_id: null,
  });
});

test("Get Status Report should return current status of report", async () => {
  const res = await api.request("/status_report/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    id: 1,
    status: "resolved",
    status_report_updates: expect.any(Array),
  });
});

test("Create a status report update not in db should return 404", async () => {
  const res = await api.request("/status_report/404/update", {
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
  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({
    code: 404,
    message: `status report with id 404 doesn't exist`,
  });
});

test("Create a status report update without auth key should return 401", async () => {
  const res = await api.request("/status_report/1/update", {
    method: "POST",
    headers: {
      //not having the key returns unauthorized
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "2023-11-08T21:03:13.000Z",
      message: "Test Status Report",
    }),
  });
  expect(res.status).toBe(401);
});
