import { expect, it, vi } from "vitest";

import * as tb from "@openstatus/tinybird";

import * as alerts from "./alerting";
import { checker } from "./checker";

vi.mock("tb");

it("should call updateMonitorStatus when we can fetch", async () => {
  const spyOn = vi.spyOn(alerts, "updateMonitorStatus").mockReturnThis();
  await checker({
    workspaceId: "2",
    monitorId: "2",
    url: "https://google.com",
    cronTimestamp: 1,
    status: "error",
    pageIds: [],
    method: "GET",
  });
  expect(spyOn).toHaveBeenCalledTimes(1);
});

it("should call updateMonitorStatus when status error", async () => {
  const spyOn = vi.spyOn(alerts, "updateMonitorStatus").mockReturnThis();
  try {
    await checker({
      workspaceId: "1",
      monitorId: "1",
      url: "https://xxxxxxx.fake",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(spyOn).toHaveBeenCalledTimes(0);
});

it("What should we do when redirect ", async () => {
  const spyOn = vi.spyOn(alerts, "updateMonitorStatus").mockReturnThis();
  try {
    await checker({
      workspaceId: "1",
      monitorId: "1",
      url: "https://www.openstatus.dev/toto",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(spyOn).toHaveBeenCalledTimes(0);
});
