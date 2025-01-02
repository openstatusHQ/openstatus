import { expect, test } from "bun:test";

import { app } from "@/index";
import { PageSubscriberSchema } from "./schema";

test("create a page subscription", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "ping@openstatus.dev" }),
  });

  const result = PageSubscriberSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a scubscriber with invalid email should return a 400", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "ping" }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page_subscriber/1/update", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
