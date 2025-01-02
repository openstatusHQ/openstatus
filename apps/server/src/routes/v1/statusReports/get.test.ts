import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportSchema } from "./schema";

test("return the status report", async () => {
  const res = await app.request("/v1/status_report/2", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = StatusReportSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.statusReportUpdateIds?.length).toBeGreaterThan(0);
  expect(result.data?.monitorIds?.length).toBeGreaterThan(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report/2");

  expect(res.status).toBe(401);
});

test("invalid status report id should return 404", async () => {
  const res = await app.request("/v1/status_report/2", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
