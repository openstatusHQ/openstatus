import { expect, test } from "bun:test";
import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("delete the monitor", async () => {
  // First create a monitor to delete
  const createRes = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Monitor to delete",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
    }),
  });

  const created = MonitorSchema.safeParse(await createRes.json());
  expect(createRes.status).toBe(200);
  expect(created.success).toBe(true);

  // Now delete it
  const res = await app.request(`/v1/monitor/${created.data?.id}`, {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({});
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/2", { method: "DELETE" });

  expect(res.status).toBe(401);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/404", {
    method: "DELETE",
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
