import type { z } from "@hono/zod-openapi";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import { expect, test } from "vitest";

import { OpenStatusApiError } from "@/libs/errors";

import { getCheckerPayload, getCheckerUrl } from "./utils";

type Monitor = z.infer<typeof selectMonitorSchema>;

function buildMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: 1,
    workspaceId: 1,
    jobType: "http",
    active: true,
    public: false,
    name: "test",
    description: "",
    url: "https://example.openstatus.dev",
    method: "GET",
    body: "",
    headers: [],
    assertions: null,
    periodicity: "10m",
    regions: ["ams"],
    timeout: 30_000,
    degradedAfter: null,
    retry: 3,
    followRedirects: true,
    otelEndpoint: null,
    otelHeaders: null,
    status: "active",
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  } as Monitor;
}

test("getCheckerUrl routes each job type to its own checker endpoint", () => {
  for (const jobType of ["http", "tcp", "dns", "icmp", "grpc"] as const) {
    const url = getCheckerUrl(buildMonitor({ jobType }));
    expect(url).toContain(`/checker/${jobType}?`);
    expect(url).toContain("monitor_id=1");
  }
});

test("getCheckerUrl rejects an unsupported job type", () => {
  expect(() =>
    getCheckerUrl(buildMonitor({ jobType: "unknown" as Monitor["jobType"] })),
  ).toThrow(OpenStatusApiError);
});

test("getCheckerPayload marks the run as api-triggered", () => {
  const payload = getCheckerPayload(
    buildMonitor({
      jobType: "icmp",
      url: "1.1.1.1",
      // Assertions are meaningless for ICMP and must not leak into the payload
      // even when the row still carries some from an earlier job type.
      assertions:
        '[{"version":"v1","type":"status","compare":"eq","target":200}]',
    }),
    "active",
  );

  expect(payload).toMatchObject({
    uri: "1.1.1.1",
    monitorId: "1",
    workspaceId: "1",
    status: "active",
    trigger: "api",
    timeout: 30_000,
  });
  expect("assertions" in payload).toBe(false);
  expect("url" in payload).toBe(false);
});

test("getCheckerPayload rejects an unsupported job type as a bad request", () => {
  let error: unknown;
  try {
    getCheckerPayload(buildMonitor({ jobType: "udp" }), "active");
  } catch (err) {
    error = err;
  }

  expect(error).toBeInstanceOf(OpenStatusApiError);
  expect(error).toMatchObject({ code: "BAD_REQUEST", status: 400 });
});
