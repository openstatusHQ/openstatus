import { expect, mock, test } from "bun:test";

import { triggerNotifications } from "./alerting";

test.todo("should send email notification", async () => {
  const fn = mock(() => {});
  mock.module("./utils.ts", () => {
    return {
      providerToFunction: {
        email: fn,
      },
    };
  });
  await triggerNotifications({
    monitorId: "1",
    statusCode: 400,
    notifType: "alert",
    cronTimestamp: 123456,
    incidentId: "1",
  });
  expect(fn).toHaveBeenCalled();
});
