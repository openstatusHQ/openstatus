import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("create a valid monitor", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      active: true,
      public: true,
    }),
  });
  const r = await res.json()
  console.log(r)
  const result = MonitorSchema.safeParse(r);
  if(result.error){
    console.error(result.error);
    throw new Error("Invalid monitor payload");
  }
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a status report with invalid payload should return 400", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "21m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
