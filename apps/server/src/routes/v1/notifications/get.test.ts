import { expect, test } from "bun:test";

import { api } from "../index";
import { NotificationSchema } from "./schema";

test("return the notification", async () => {
  const res = await api.request("/notification/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = NotificationSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await api.request("/notification/1");

  expect(res.status).toBe(401);
});

test("invalid notification id should return 404", async () => {
  const res = await api.request("/notification/404", {
    headers: {
      "x-openstatus-key": "1",
    },
  });

  expect(res.status).toBe(404);
});

test("invalid auth key should return 404", async () => {
  const res = await api.request("/notification/1", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
