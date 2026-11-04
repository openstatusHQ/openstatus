import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { buildCommonMessageData, monitorTarget } from "./message";

const monitor: Monitor = {
  id: 42,
  name: "Nightly backup",
  url: "",
  periodicity: "other",
  jobType: "heartbeat",
  active: true,
  public: false,
  createdAt: null,
  updatedAt: null,
  regions: [],
  description: "",
  headers: [],
  body: "",
  workspaceId: 1,
  timeout: 45000,
  degradedAfter: null,
  assertions: null,
  status: "error",
  method: "GET",
  deletedAt: null,
  otelEndpoint: null,
  otelHeaders: [],
  retry: 3,
  followRedirects: true,
  externalName: null,
  grpcService: null,
  grpcTls: null,
  heartbeatToken: "secret-token",
  heartbeatPeriod: 86_400,
  heartbeatGrace: 1_800,
  heartbeatCron: null,
  heartbeatTz: null,
};

const notification: Notification = {
  id: 1,
  name: "Slack",
  data: "{}",
  createdAt: null,
  updatedAt: null,
  provider: "slack",
  workspaceId: 1,
};

describe("buildCommonMessageData (heartbeat)", () => {
  test("describes the missed ping instead of http fields", () => {
    const data = buildCommonMessageData({
      monitor,
      notification,
      cronTimestamp: Date.UTC(2026, 0, 2),
      regions: ["heartbeat"],
      message: "No ping since 2026-01-01T00:00:00.000Z",
    });

    expect(data.monitorUrl).toBe("https://app.openstatus.dev/monitors/42");
    expect(data.monitorMethod).toBeUndefined();
    expect(data.statusCodeFormatted).toBe("Expected every 1d (+30m grace)");
    expect(data.errorMessage).toBe("No ping since 2026-01-01T00:00:00.000Z");
    expect(data.regionsDisplay).toBe("Heartbeat");
    expect(data.latencyDisplay).toBe("N/A");
    expect(JSON.stringify(data)).not.toContain("secret-token");
  });

  test("monitorTarget points heartbeats at the dashboard", () => {
    expect(monitorTarget(monitor)).toBe(
      "https://app.openstatus.dev/monitors/42",
    );
    expect(
      monitorTarget({ ...monitor, jobType: "http", url: "https://a.dev" }),
    ).toBe("https://a.dev");
  });
});
