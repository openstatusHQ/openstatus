import type {
  Headers,
  OpenTelemetryConfig,
} from "@openstatus/proto/monitor/v1";

// ============================================================
// DB to Proto (for reads)
// ============================================================

/**
 * Convert headers array to proto Headers array.
 */
export function toProtoHeaders(
  headers: Array<{ key: string; value: string }> | null | undefined,
): Headers[] {
  if (!headers || headers.length === 0) {
    return [];
  }

  return headers.map((h) => ({
    $typeName: "openstatus.monitor.v1.Headers" as const,
    key: h.key,
    value: h.value,
  }));
}

/**
 * Parse OpenTelemetry configuration from database fields.
 */
export function parseOpenTelemetry(
  endpoint: string | null,
  headers: Array<{ key: string; value: string }> | null | undefined,
): OpenTelemetryConfig | undefined {
  if (!endpoint) {
    return undefined;
  }

  return {
    $typeName: "openstatus.monitor.v1.OpenTelemetryConfig",
    endpoint,
    headers: toProtoHeaders(headers),
  };
}

// ============================================================
// Proto to service input (for writes)
// ============================================================

/** Strip the proto wrapper down to the `{key,value}[]` the services take. */
export function protoHeadersToService(
  headers: Headers[],
): Array<{ key: string; value: string }> | undefined {
  if (headers.length === 0) {
    return undefined;
  }

  return headers.map((h) => ({ key: h.key, value: h.value }));
}

export function protoOpenTelemetryToService(
  config: OpenTelemetryConfig | undefined,
): {
  otelEndpoint: string | undefined;
  otelHeaders: Array<{ key: string; value: string }> | undefined;
} {
  if (!config || !config.endpoint) {
    return {
      otelEndpoint: undefined,
      otelHeaders: undefined,
    };
  }

  return {
    otelEndpoint: config.endpoint,
    otelHeaders: protoHeadersToService(config.headers),
  };
}
