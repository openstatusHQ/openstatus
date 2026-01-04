import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportSchema } from "../schema";

test("create status report update with valid data should return 200", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      message: "The issue has been resolved and we are monitoring",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = StatusReportSchema.safeParse(json);
  expect(result.success).toBe(true);
});

test("create status report update with different status should return 200", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "identified",
      message: "We have identified the issue",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = StatusReportSchema.safeParse(json);
  expect(result.success).toBe(true);
});

test("create status report update with invalid status report id should return 404", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/999999/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      message: "The issue has been resolved and we are monitoring",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(404);
});

test("create status report update with invalid status should return 400", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "invalid_status",
      message: "Test message",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(400);
});

test("create status report update without auth key should return 401", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/1/update", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      message: "Test message",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(401);
});

test("create status report update from different workspace should return 404", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/2/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      message: "Test message",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(404);
});

test("create status report update without message should return 400", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      date: date.toISOString(),
    }),
  });

  expect(res.status).toBe(400);
});
