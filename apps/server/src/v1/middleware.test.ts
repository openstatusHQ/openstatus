import { expect, test } from "bun:test";

import { api } from "./index";

test("Middleware error should return json", async () => {
  const res = await api.request("/status_report/1", {});

  const json = await res.json();
  expect(res.status).toBe(401);
  expect(json).toMatchObject({
    code: "UNAUTHORIZED",
    message: "Unauthorized",
    docs: "https://docs.openstatus.dev/api-references/errors/code/UNAUTHORIZED",
  });
});
