import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportUpdateSchema } from "./schema";

test("return the status report update", async () => {
  const res = await app.request("/v1/status_report_update/2", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = StatusReportUpdateSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report_update/2");

  expect(res.status).toBe(401);
});

test("invalid status report id should return 404", async () => {
  const res = await app.request("/v1/status_report_update/2", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
