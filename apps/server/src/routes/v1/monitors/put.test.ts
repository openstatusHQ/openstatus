import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("update the monitor", async () => {
  const res = await app.request("/v1/monitor/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "New Name",
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.name).toBe("New Name");
});

test("update the monitor with a different jobType should return 400", async () => {
  const res = await app.request("/v1/monitor/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobType: "tcp",
    }),
  });

  expect(res.status).toBe(400);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/page/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      /* */
    }),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      /* */
    }),
  });

  expect(res.status).toBe(401);
});
