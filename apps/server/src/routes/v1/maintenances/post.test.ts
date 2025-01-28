import { expect, test } from "bun:test";
import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

test("create a valid maintenance", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000); // 1 hour later

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Database Upgrade",
      message: "Scheduled database maintenance",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 1,
    }),
  });

  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(1);
});

test("create a maintenance with invalid dates should return 400", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Maintenance",
      message: "Test message",
      from: "invalid-date",
      to: "invalid-date",
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
