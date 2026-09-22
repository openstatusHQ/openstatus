import type {
  Headers,
  OpenTelemetryConfig,
} from "@openstatus/proto/monitor/v1";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  parseOpenTelemetry,
  protoHeadersToService,
  protoOpenTelemetryToService,
  toProtoHeaders,
} from "./headers";

function header(key: string, value: string): Headers {
  return { $typeName: "openstatus.monitor.v1.Headers", key, value };
}

function otelConfig(endpoint: string, headers: Headers[]): OpenTelemetryConfig {
  return {
    $typeName: "openstatus.monitor.v1.OpenTelemetryConfig",
    endpoint,
    headers,
  };
}

describe("protoHeadersToService", () => {
  test("returns undefined for an empty list so the column keeps its default", () => {
    expect(protoHeadersToService([])).toBeUndefined();
  });

  test("strips the proto wrapper", () => {
    expect(protoHeadersToService([header("a", "1"), header("b", "2")])).toEqual(
      [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ],
    );
  });

  test("round-trips back to proto headers", () => {
    const input = [header("x-token", "secret")];
    const back = toProtoHeaders(protoHeadersToService(input));
    expect(back).toEqual(input);
  });
});

describe("protoOpenTelemetryToService", () => {
  test("returns both fields undefined when no config is set", () => {
    expect(protoOpenTelemetryToService(undefined)).toEqual({
      otelEndpoint: undefined,
      otelHeaders: undefined,
    });
  });

  test("treats an empty endpoint as no config", () => {
    // An endpoint-less config must not write headers, or the monitor ends
    // up with otel headers pointing at nothing.
    expect(
      protoOpenTelemetryToService(otelConfig("", [header("a", "1")])),
    ).toEqual({
      otelEndpoint: undefined,
      otelHeaders: undefined,
    });
  });

  test("passes the endpoint through and unwraps headers", () => {
    expect(
      protoOpenTelemetryToService(
        otelConfig("https://otel.example.com", [
          header("authorization", "Bearer x"),
        ]),
      ),
    ).toEqual({
      otelEndpoint: "https://otel.example.com",
      otelHeaders: [{ key: "authorization", value: "Bearer x" }],
    });
  });

  test("round-trips back to a proto config", () => {
    const endpoint = "https://otel.example.com";
    const headers = [header("a", "1")];
    const service = protoOpenTelemetryToService(otelConfig(endpoint, headers));
    const back = parseOpenTelemetry(
      service.otelEndpoint ?? null,
      service.otelHeaders,
    );

    expect(back?.endpoint).toBe(endpoint);
    expect(back?.headers).toEqual(headers);
  });
});
