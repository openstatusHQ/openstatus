import { expect, test } from "bun:test";

import { api } from ".";

test("Create a page", async () => {
  const data = {
    title: "OpenStatus",
    description: "OpenStatus website",
    slug: "openstatus",
  };
  const res = await api.request("/page", {
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
    title: "OpenStatus",
    description: "OpenStatus website",
    slug: "openstatus",
  });
});

test("Create a page with monitors", async () => {
  const data = {
    title: "OpenStatus",
    description: "OpenStatus website",
    slug: "new-openstatus",
    monitors: [1, 2],
  };
  const res = await api.request("/page", {
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
    title: "OpenStatus",
    description: "OpenStatus website",
    slug: "new-openstatus",
  });
});

test("Update a page with monitors as object including order", async () => {
  const data = {
    monitors: [
      { monitorId: 1, order: 0 },
      { monitorId: 2, order: 1 },
    ],
  };
  const res = await api.request("/page/3", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: 3,
  });
});

test("Create a page without auth key should return 401", async () => {
  const data = {
    title: "OpenStatus",
    description: "OpenStatus website",
    slug: "openstatus",
  };
  const res = await api.request("/page", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  expect(res.status).toBe(401);
});

test("Create a page with invalid data should return 403", async () => {
  const data = {
    description: "OpenStatus website",
    slug: "openstatus",
  };
  const res = await api.request("/page", {
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
