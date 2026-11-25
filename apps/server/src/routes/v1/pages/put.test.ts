import { expect, test } from "vitest";

import { app } from "@/index";

import { PageSchema } from "./schema";

test("update the page with monitor ids", async () => {
  const res = await app.request("/v1/page/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "New Title",
      monitors: [1, 2],
    }),
  });

  const result = PageSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.title).toBe("New Title");
  expect(result.data?.monitors).toEqual([1, 2]);
});

test("update the page with monitor objects", async () => {
  const res = await app.request("/v1/page/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monitors: [
        { monitorId: 1, order: 1 },
        { monitorId: 2, order: 2 },
      ],
    }),
  });

  const result = PageSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitors).toEqual([
    { monitorId: 1, order: 1 },
    { monitorId: 2, order: 2 },
  ]);
});

test("update the page with invalid monitors should return 400", async () => {
  const res = await app.request("/v1/page/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monitors: [404],
    }),
  });
  expect(res.status).toBe(400);
});

test("invalid page id should return 404", async () => {
  const res = await app.request("/v1/page/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      acknowledgedAt: new Date().toISOString(),
    }),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      acknowledgedAt: new Date().toISOString(),
    }),
  });
  expect(res.status).toBe(401);
});

test("update the page with a custom domain another page uses should return 409", async () => {
  const res = await app.request("/v1/page/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    // Seeded on page 2.
    body: JSON.stringify({ customDomain: "status.acme.com" }),
  });

  expect(res.status).toBe(409);
});

test("update the page keeping its own custom domain", async () => {
  const res = await app.request("/v1/page/2", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customDomain: "status.acme.com" }),
  });

  expect(res.status).toBe(200);
});

test("update a missing page with a taken custom domain should return 404", async () => {
  const res = await app.request("/v1/page/999999", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    // Seeded on page 2.
    body: JSON.stringify({ customDomain: "status.acme.com" }),
  });

  expect(res.status).toBe(404);
});
