import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportSchema } from "./schema";

test("create a valid status report", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  const result = StatusReportSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.statusReportUpdateIds?.length).toBeGreaterThan(0);
  expect(result.data?.monitorIds?.length).toBeGreaterThan(0);
});

test("create a status report with invalid monitor should return 400", async () => {
  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [404],
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a status report with invalid page id should return 400", async () => {
  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      pageId: 404,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
