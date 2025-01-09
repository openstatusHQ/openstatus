import { expect, test } from "bun:test";
import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

test("update the maintenance", async () => {
  const res = await app.request("/v1/maintenance/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Updated Maintenance",
      message: "Updated message",
    }),
  });

  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.title).toBe("Updated Maintenance");
});

test("update maintenance monitors", async () => {
  const res = await app.request("/v1/maintenance/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monitorIds: [1, 2],
    }),
  });

  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(2);
});

test("invalid maintenance id should return 404", async () => {
  const res = await app.request("/v1/maintenance/999", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Not Found",
    }),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance/1", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(401);
});

test("update with invalid monitor ids should return 400", async () => {
  const res = await app.request("/v1/maintenance/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      monitorIds: [999], // Non-existent monitor
    }),
  });

  expect(res.status).toBe(400);
});

test("update with invalid page id should return 400", async () => {
  const res = await app.request("/v1/maintenance/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pageId: 999, // Non-existent page
    }),
  });

  expect(res.status).toBe(400);
});
