import { expect, it, vi } from "vitest";

import type { Tinybird } from "@openstatus/tinybird";
import {
  publishPingResponse,
  tbIngestPingResponse,
} from "@openstatus/tinybird";

import * as alerts from "./alerting";
import { checker } from "./checker";

vi.mock("@openstatus/tinybird", async () => {
  const actual = await vi.importActual("@openstatus/tinybird");
  return {
    // @ts-ignore
    ...actual,
    publishPingResponse: vi.fn(),
  };
});

it("should call updateMonitorStatus when we can fetch", async () => {
  const spyOn = vi.spyOn(alerts, "updateMonitorStatus").mockReturnThis();
  await checker({
    workspaceId: "1",
    monitorId: "1",
    url: "https://www.google.com",
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
