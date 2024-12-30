import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportUpdateSchema } from "./schema";

test("create a valid status report update", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: new Date().toISOString(),
      message: "Message",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a status report update without valid payload should return 400", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: "test",
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
