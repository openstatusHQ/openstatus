import { expect, test } from "bun:test";

import { api } from "../index";

test("Create a notification", async () => {
  const data = {
    name: "OpenStatus",
    provider: "email",
    payload: { email: "ping@openstatus.dev" },
  };
  const res = await api.request("/notification", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await res.json();

  expect(res.status).toBe(200);

  expect(json).toMatchObject({
    id: expect.any(Number),
    provider: "email",
    payload: { email: "ping@openstatus.dev" },
  });
});
