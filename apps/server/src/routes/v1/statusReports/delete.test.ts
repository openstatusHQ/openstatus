import { expect, test } from "bun:test";

import { app } from "@/index";

test("delete the status report", async () => {
  const res = await app.request("/v1/status_report/3", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({});
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
