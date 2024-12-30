import { expect, test } from "bun:test";

import { app } from "@/index";
import { SummarySchema } from "./schema";

// FIXME: {"code":"INTERNAL_SERVER_ERROR","message":"invalid authentication token. Invalid token b'test': Not enough segments","docs":"https://docs.openstatus.dev/api-references/errors/code/INTERNAL_SERVER_ERROR"}
test.skip("return the summary of the monitor", async () => {
  const res = await app.request("/v1/monitor/1/summary", {
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = SummarySchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/summary");

  expect(res.status).toBe(401);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/404/summary", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
