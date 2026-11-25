import { describe, expect, test } from "vitest";

import { selectPublicMonitorSchema } from "./index";

describe("selectPublicMonitorSchema", () => {
  test("never exposes the heartbeat ping token", () => {
    const parsed = selectPublicMonitorSchema.parse({
      id: 1,
      jobType: "heartbeat",
      periodicity: "other",
      status: "active",
      active: true,
      regions: "",
      url: "",
      name: "nightly backup",
      externalName: null,
      description: "",
      headers: "[]",
      body: "",
      method: "GET",
      workspaceId: 1,
      timeout: 45000,
      degradedAfter: null,
      assertions: null,
      otelEndpoint: null,
      otelHeaders: null,
      public: true,
      retry: 3,
      followRedirects: true,
      grpcService: null,
      grpcTls: "tls",
      heartbeatToken: "secret-ping-token",
      heartbeatPeriod: 3600,
      heartbeatGrace: 300,
      heartbeatCron: null,
      heartbeatTz: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
    });

    expect(parsed).not.toHaveProperty("heartbeatToken");
    expect(JSON.stringify(parsed)).not.toContain("secret-ping-token");
  });
});
