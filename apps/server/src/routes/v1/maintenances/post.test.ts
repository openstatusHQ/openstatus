import { expect, test } from "bun:test";
import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

test("create a valid maintenance without monitorIds", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000); // 1 hour later

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Another Maintenance",
      message: "Scheduled maintenance without monitors",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });

  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(0);
});

test("create a maintenance with `from` date after `to` date should return 400", async () => {
  const to = new Date();
  const from = new Date(to.getTime() + 3600000); // from is 1 hour after to

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Dates",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with non-existent monitorIds should return 400", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Monitors",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [9999], // Non-existent monitor ID
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with non-existent pageId should return 400", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Page",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 9999, // Non-existent page ID
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with empty body should return 400", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(400);
});

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
