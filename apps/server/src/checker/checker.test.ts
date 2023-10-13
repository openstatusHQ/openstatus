import { expect, test, vi } from "vitest";

import * as tb from "@openstatus/tinybird";

import * as alerts from "./alerting";
import { checker } from "./checker";

vi.mock("tb");

test("Checker", async () => {
  const spyOn = vi.spyOn(alerts, "updateMonitorStatus").mockReturnThis();
  await checker({
    workspaceId: "1",
    monitorId: "1",
    url: "https://google.com",
    cronTimestamp: 1,
    status: "error",
    pageIds: [],
    method: "GET",
  });
  expect(spyOn).toHaveBeenCalledTimes(1);
});
