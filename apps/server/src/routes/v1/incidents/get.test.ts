import { expect, test } from "bun:test";

import { app } from "@/index";
import { IncidentSchema } from "./schema";

test("return the incident", async () => {
  const res = await app.request("/v1/incident/2", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = IncidentSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/incident/2");

  expect(res.status).toBe(401);
});

test("invalid incident id should return 404", async () => {
  const res = await app.request("/v1/incident/2", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
