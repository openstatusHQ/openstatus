import { expect, test } from "bun:test";

import { api } from "../index";
import { PageSchema } from "./schema";

test("return the page", async () => {
  const res = await api.request("/page/1", {
    headers: {
      "x-openstatus-key": "1",
    },
  });
  const result = PageSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("no auth key should return 401", async () => {
  const res = await api.request("/page/2");

  expect(res.status).toBe(401);
});

test("invalid page id should return 404", async () => {
  const res = await api.request("/page/2", {
    headers: {
      "x-openstatus-key": "2",
    },
  });

  expect(res.status).toBe(404);
});
