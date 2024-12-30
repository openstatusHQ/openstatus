import { expect, test } from "bun:test";

import { api } from "../index";
import { IncidentSchema } from "./schema";

test("acknlowledge the incident", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await api.request("/incident/2", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      acknowledgedAt: date.toISOString(),
    }),
  });

  const result = IncidentSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.acknowledgedAt?.toISOString()).toBe(date.toISOString());
});

test("resolve the incident", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await api.request("/incident/2", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resolvedAt: date.toISOString(),
    }),
  });

  const result = IncidentSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.resolvedAt?.toISOString()).toBe(date.toISOString());
});

test("invalid incident id should return 404", async () => {
  const res = await api.request("/incident/404", {
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
  const res = await api.request("/incident/2", {
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

test("update the incident with invalid data should return 400", async () => {
  const res = await api.request("/incident/2", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      acknowledgedAt: "2023-11-0",
    }),
  });
  expect(res.status).toBe(400);
});
