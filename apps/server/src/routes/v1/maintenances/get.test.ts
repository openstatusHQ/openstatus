import { expect, test } from "bun:test";
import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

test("return the maintenance", async () => {
  const res = await app.request("/v1/maintenance/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance/1");

  expect(res.status).toBe(401);
});

test("invalid maintenance id should return 404", async () => {
  const res = await app.request("/v1/maintenance/999", {
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});
