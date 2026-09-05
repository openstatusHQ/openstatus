import type { z } from "@hono/zod-openapi";
import type { selectMonitorSchema } from "@openstatus/db/src/schema";
import { expect, test } from "@openstatus/test-utils";

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

test("getCheckerPayload builds an ICMP payload without assertions", () => {
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

test("getCheckerPayload builds a gRPC payload with its target configuration", () => {
  const payload = getCheckerPayload(
    buildMonitor({
      jobType: "grpc",
      url: "api.example.com:443",
      grpcService: "checkout.v1.CheckoutService",
      grpcTls: "tls_insecure",
      headers: [{ key: "authorization", value: "Bearer token" }],
      assertions:
        '[{"version":"v1","type":"status","compare":"eq","target":200}]',
    }),
    "active",
  );

  expect(payload).toMatchObject({
    uri: "api.example.com:443",
    service: "checkout.v1.CheckoutService",
    tls: "tls_insecure",
    headers: { authorization: "Bearer token" },
    trigger: "api",
  });
  expect("assertions" in payload).toBe(false);
});

// The column is nullable and only defaults on insert, so a row that predates
// the default must still dial with verification on.
test("getCheckerPayload defaults a gRPC monitor with no TLS mode to tls", () => {
  const payload = getCheckerPayload(
    buildMonitor({ jobType: "grpc", url: "api.example.com:443" }),
    "active",
  );

  expect(payload).toMatchObject({ tls: "tls" });
});

test("getCheckerPayload builds a DNS payload with assertions", () => {
  const payload = getCheckerPayload(
    buildMonitor({
      jobType: "dns",
      url: "openstatus.dev",
      assertions:
        '[{"version":"v1","type":"dnsRecord","record":"A","compare":"eq","target":"1.2.3.4"}]',
    }),
    "active",
  );

  expect(payload).toMatchObject({ uri: "openstatus.dev", trigger: "api" });
  expect("assertions" in payload).toBe(true);
});

test("getCheckerPayload forwards the OTel config when configured", () => {
  const payload = getCheckerPayload(
    buildMonitor({
      jobType: "icmp",
      url: "1.1.1.1",
      otelEndpoint: "https://otel.example.com:4318",
      otelHeaders: [{ key: "Authorization", value: "Basic dGVzdA==" }],
    }),
    "active",
  );

  expect(payload.otelConfig).toEqual({
    endpoint: "https://otel.example.com:4318",
    headers: { Authorization: "Basic dGVzdA==" },
  });
});

test("getCheckerPayload rejects an unsupported job type", () => {
  expect(() =>
    getCheckerPayload(
      buildMonitor({ jobType: "unknown" as Monitor["jobType"] }),
      "active",
    ),
  ).toThrow(OpenStatusApiError);
});
