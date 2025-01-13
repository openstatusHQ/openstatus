import { expect, test } from "bun:test";

import { app } from "@/index";
import { StatusReportSchema } from "./schema";

test("delete the status report", async () => {
  // Create a status report we will delete
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

  const del = await app.request(`/v1/status_report/${result.data?.id}`, {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(del.status).toBe(200);
  expect(await del.json()).toMatchObject({});
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report/2", { method: "DELETE" });

  expect(res.status).toBe(401);
});

test("invalid status report id should return 404", async () => {
  const res = await app.request("/v1/status_report/2", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
