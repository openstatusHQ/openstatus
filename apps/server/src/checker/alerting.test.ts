import { expect, mock, test } from "bun:test";

import { triggerAlerting } from "./alerting";

test("should send email notification", async () => {
  const fn = mock(() => {});
  mock.module("./utils.ts", () => {
    return {
      providerToFunction: {
        email: fn,
      },
    };
  });
  await triggerAlerting({ monitorId: "1" });
  expect(fn).toHaveBeenCalled();
});
