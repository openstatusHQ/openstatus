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
// Proto to DB (for writes)
// ============================================================

/**
 * Convert proto Headers array to database JSON string.
 */
export function headersToDbJson(headers: Headers[]): string | undefined {
  if (headers.length === 0) {
    return undefined;
  }

  return JSON.stringify(headers.map((h) => ({ key: h.key, value: h.value })));
}

/**
 * Convert OpenTelemetry config to database fields.
 */
export function openTelemetryToDb(config: OpenTelemetryConfig | undefined): {
  otelEndpoint: string | undefined;
  otelHeaders: string | undefined;
} {
  if (!config || !config.endpoint) {
    return {
      otelEndpoint: undefined,
      otelHeaders: undefined,
    };
  }

  return {
    otelEndpoint: config.endpoint,
    otelHeaders: headersToDbJson(config.headers),
  };
}
