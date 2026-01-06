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

test("create status report update with identified status should return 200", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "identified",
      date: new Date().toISOString(),
      message: "We have identified the root cause",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with monitoring status should return 200", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      date: new Date().toISOString(),
      message: "The fix has been deployed and we are monitoring",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with resolved status should return 200", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "resolved",
      date: new Date().toISOString(),
      message: "Issue has been fully resolved",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update without date should use default", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      message: "Update without explicit date",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with past date should return 200", async () => {
  const pastDate = new Date();
  pastDate.setTime(pastDate.getTime() - 24 * 60 * 60 * 1000);

  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: pastDate.toISOString(),
      message: "Update with past date",
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with long message should return 200", async () => {
  const longMessage =
    "This is a very detailed status update message that provides comprehensive information about the incident, including what happened, what is being done to resolve it, and what measures are being taken to prevent similar issues in the future. We apologize for any inconvenience this may have caused.";

  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "monitoring",
      date: new Date().toISOString(),
      message: longMessage,
      statusReportId: 1,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with different status report ID should return 200", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: new Date().toISOString(),
      message: "Update for different report",
      statusReportId: 2,
    }),
  });

  const result = StatusReportUpdateSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create status report update with invalid status should return 400", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "invalid_status",
      date: new Date().toISOString(),
      message: "Test message",
      statusReportId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create status report update without message should return 400", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: new Date().toISOString(),
      statusReportId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create status report update without statusReportId should return 400", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: new Date().toISOString(),
      message: "Test message",
    }),
  });

  expect(res.status).toBe(400);
});

test("create status report update with empty message should return 400", async () => {
  const res = await app.request("/v1/status_report_update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      date: new Date().toISOString(),
      message: "",
      statusReportId: 1,
    }),
  });

  expect(res.status).toBe(400);
});
