import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportSchema } from "./schema";

test("return all status reports", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.length).toBeGreaterThan(0);
});

test("return all status reports with monitorIds", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.length).toBeGreaterThan(0);
  // Each status report should have monitorIds defined
  for (const statusReport of result.data || []) {
    expect(statusReport.monitorIds).toBeDefined();
    expect(Array.isArray(statusReport.monitorIds)).toBe(true);
    // Ensure each monitorId is a number
    for (const monitorId of statusReport.monitorIds || []) {
      expect(typeof monitorId).toBe("number");
    }
  }
});

test("return empty status reports", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "2",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
