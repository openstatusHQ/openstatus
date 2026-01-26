import { expect, test } from "bun:test";
import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

test("return all maintenances", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());
  console.log(result);
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.length).toBeGreaterThan(0);
});

test("return all maintenances with monitorIds", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.length).toBeGreaterThan(0);
  // Each maintenance should have monitorIds defined
  for (const maintenance of result.data || []) {
    expect(maintenance.monitorIds).toBeDefined();
    expect(Array.isArray(maintenance.monitorIds)).toBe(true);
  }
});

test("return empty maintenances", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "2",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
