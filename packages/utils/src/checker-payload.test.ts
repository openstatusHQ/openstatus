import { describe, expect, test } from "vitest";

import { type CheckerMonitor, buildCheckerPayload } from "./checker-payload";

const monitor = (overrides: Partial<CheckerMonitor> = {}): CheckerMonitor => ({
  id: 42,
  workspaceId: 7,
  jobType: "http",
  url: "https://example.com",
  method: "GET",
  body: "",
  headers: [{ key: "x-api-key", value: "secret" }],
  assertions: null,
  degradedAfter: null,
  timeout: 45_000,
  retry: 3,
  followRedirects: true,
  otelEndpoint: null,
  otelHeaders: [],
  grpcService: null,
  grpcTls: null,
  ...overrides,
});

const build = (m: CheckerMonitor, trigger: "cron" | "api" = "cron") =>
  buildCheckerPayload({
    monitor: m,
    status: "active",
    trigger,
    timestamp: 1_700_000_000_000,
  });

describe("buildCheckerPayload", () => {
  test("http keeps the request shape the checker binds", () => {
    expect(
      build(
        monitor({
          assertions:
            '[{"version":"v1","type":"status","compare":"eq","target":200}]',
        }),
        "api",
      ),
    ).toMatchObject({
      workspaceId: "7",
      monitorId: "42",
      url: "https://example.com",
      method: "GET",
      cronTimestamp: 1_700_000_000_000,
      headers: [{ key: "x-api-key", value: "secret" }],
      assertions: [
        { version: "v1", type: "status", compare: "eq", target: 200 },
      ],
      trigger: "api",
      retry: 3,
      followRedirects: true,
    });
  });

  test("http honours a disabled followRedirects", () => {
    expect(build(monitor({ followRedirects: false }))).toMatchObject({
      followRedirects: false,
    });
  });

  test("defaults a missing retry to the checker default", () => {
    expect(build(monitor({ retry: null }))).toMatchObject({ retry: 3 });
  });

  test.each(["tcp", "dns"] as const)(
    "%s sends uri and assertions",
    (jobType) => {
      const payload = build(
        monitor({
          jobType,
          url: "example.com:443",
          assertions:
            '[{"version":"v1","type":"status","compare":"eq","target":200}]',
        }),
      );
      expect(payload).toMatchObject({ uri: "example.com:443" });
      expect("assertions" in payload).toBe(true);
      expect("url" in payload).toBe(false);
      expect("followRedirects" in payload).toBe(false);
    },
  );

  test("icmp drops assertions a previous job type left on the row", () => {
    const payload = build(
      monitor({
        jobType: "icmp",
        url: "1.1.1.1",
        assertions:
          '[{"version":"v1","type":"status","compare":"eq","target":200}]',
      }),
    );
    expect(payload).toMatchObject({ uri: "1.1.1.1" });
    expect("assertions" in payload).toBe(false);
  });

  test("grpc sends headers as a map and defaults tls", () => {
    expect(
      build(
        monitor({
          jobType: "grpc",
          url: "grpc.example.com:443",
          grpcService: "health",
        }),
      ),
    ).toMatchObject({
      uri: "grpc.example.com:443",
      service: "health",
      tls: "tls",
      headers: { "x-api-key": "secret" },
    });
  });

  test("forwards the OTel config when configured", () => {
    const payload = build(
      monitor({
        otelEndpoint: "https://otel.example.com:4318",
        otelHeaders: [{ key: "Authorization", value: "Basic dGVzdA==" }],
      }),
    );
    expect(payload.otelConfig).toEqual({
      endpoint: "https://otel.example.com:4318",
      headers: { Authorization: "Basic dGVzdA==" },
    });
  });

  test.each(["icmp", "grpc"] as const)(
    "%s ignores a malformed assertions string",
    (jobType) => {
      expect(() =>
        build(monitor({ jobType, assertions: "{not json" })),
      ).not.toThrow();
    },
  );

  test("http still rejects a malformed assertions string", () => {
    expect(() => build(monitor({ assertions: "{not json" }))).toThrow(
      SyntaxError,
    );
  });

  test("rejects an unsupported job type", () => {
    expect(() => build(monitor({ jobType: "udp" }))).toThrow("Invalid jobType");
  });
});
