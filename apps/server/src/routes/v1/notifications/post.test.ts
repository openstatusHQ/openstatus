import { expect, test } from "bun:test";

import { app } from "@/index";
import { NotificationSchema } from "./schema";

test("create a notification", async () => {
  const res = await app.request("/v1/notification", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "OpenStatus",
      provider: "email",
      payload: { email: "ping@openstatus.dev" },
      monitors: [1],
    }),
  });

  const result = NotificationSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a notification with invalid monitor ids should return a 400", async () => {
  const res = await app.request("/v1/notification", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "OpenStatus",
      provider: "email",
      payload: { email: "ping@openstatus.dev" },
      monitors: [404],
    }),
  });

  expect(res.status).toBe(400);
});

test("create a email notification with invalid payload should return a 400", async () => {
  const res = await app.request("/v1/notification", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "OpenStatus",
      provider: "email",
      payload: { hello: "world" },
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/notification", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
