import { AVAILABLE_REGIONS } from "@openstatus/regions";
import type { Monitor } from "@openstatus/db/src/schema/monitors/validation";
import {
  type BodyAssertion,
  type DNSMonitor,
  type HTTPMonitor,
  type HeaderAssertion,
  type Headers,
  NumberComparator,
  type OpenTelemetryConfig,
  type RecordAssertion,
  RecordComparator,
  type StatusCodeAssertion,
  StringComparator,
  type TCPMonitor,
} from "@openstatus/proto/monitor/v1";



/**
 * Default values for monitor fields.
 */
export const MONITOR_DEFAULTS = {
  timeout: 45000,
  retry: 3,
  followRedirects: true,
  active: false,
  public: false,
  description: "",
} as const;

/**
 * Validate that all regions are valid available regions.
 * Returns an array of invalid region codes, or empty array if all valid.
 */
export function validateRegions(regions: string[]): string[] {
  const availableSet = new Set(AVAILABLE_REGIONS);
  return regions.filter((r) => !availableSet.has(r as typeof AVAILABLE_REGIONS[number]));
}

// ============================================================
// DB to Proto Conversion Functions (for reads)
// ============================================================

/**
 * Convert database compare string to NumberComparator.
 */
export function compareToNumberComparator(compare: string): NumberComparator {
  switch (compare) {
    case "eq":
      return NumberComparator.EQUAL;
    case "not_eq":
      return NumberComparator.NOT_EQUAL;
    case "gt":
      return NumberComparator.GREATER_THAN;
    case "gte":
      return NumberComparator.GREATER_THAN_OR_EQUAL;
    case "lt":
      return NumberComparator.LESS_THAN;
    case "lte":
      return NumberComparator.LESS_THAN_OR_EQUAL;
    default:
      return NumberComparator.UNSPECIFIED;
  }
}

/**
 * Convert database compare string to StringComparator.
 */
export function compareToStringComparator(compare: string): StringComparator {
  switch (compare) {
    case "eq":
      return StringComparator.EQUAL;
    case "not_eq":
      return StringComparator.NOT_EQUAL;
    case "contains":
      return StringComparator.CONTAINS;
    case "not_contains":
      return StringComparator.NOT_CONTAINS;
    case "empty":
      return StringComparator.EMPTY;
    case "not_empty":
      return StringComparator.NOT_EMPTY;
    case "gt":
      return StringComparator.GREATER_THAN;
    case "gte":
      return StringComparator.GREATER_THAN_OR_EQUAL;
    case "lt":
      return StringComparator.LESS_THAN;
    case "lte":
      return StringComparator.LESS_THAN_OR_EQUAL;
    default:
      return StringComparator.UNSPECIFIED;
  }
}

/**
 * Convert database compare string to RecordComparator.
 */
export function compareToRecordComparator(compare: string): RecordComparator {
  switch (compare) {
    case "eq":
      return RecordComparator.EQUAL;
    case "not_eq":
      return RecordComparator.NOT_EQUAL;
    case "contains":
      return RecordComparator.CONTAINS;
    case "not_contains":
      return RecordComparator.NOT_CONTAINS;
    default:
      return RecordComparator.UNSPECIFIED;
  }
}

/**
 * Convert headers array to proto Headers array.
 */
export function toProtoHeaders(headers: Array<{ key: string; value: string }> | null | undefined): Headers[] {
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
 * Parse database assertions JSON for HTTP monitors.
 */
export function parseHttpAssertions(assertionsJson: string | null): {
  statusCodeAssertions: StatusCodeAssertion[];
  bodyAssertions: BodyAssertion[];
  headerAssertions: HeaderAssertion[];
} {
  const result: {
    statusCodeAssertions: StatusCodeAssertion[];
    bodyAssertions: BodyAssertion[];
    headerAssertions: HeaderAssertion[];
  } = {
    statusCodeAssertions: [],
    bodyAssertions: [],
    headerAssertions: [],
  };

  if (!assertionsJson) {
    return result;
  }

  try {
    const assertions = JSON.parse(assertionsJson) as Array<{
      type: string;
      compare: string;
      target: string | number;
      key?: string;
    }>;

    for (const a of assertions) {
      switch (a.type) {
        case "status":
          result.statusCodeAssertions.push({
            $typeName: "openstatus.monitor.v1.StatusCodeAssertion" as const,
            target: BigInt(a.target),
            comparator: compareToNumberComparator(a.compare),
          });
          break;
        case "textBody":
        case "jsonBody":
          result.bodyAssertions.push({
            $typeName: "openstatus.monitor.v1.BodyAssertion" as const,
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
          });
          break;
        case "header":
          result.headerAssertions.push({
            $typeName: "openstatus.monitor.v1.HeaderAssertion" as const,
            target: String(a.target),
            comparator: compareToStringComparator(a.compare),
            key: a.key ?? "",
          });
          break;
      }
    }
  } catch (error) {
    console.error("[monitor-utils] Failed to parse HTTP assertions JSON:", error);
  }

  return result;
}

/**
 * Parse database assertions JSON for DNS monitors.
 */
export function parseDnsAssertions(
  assertionsJson: string | null,
): RecordAssertion[] {
  if (!assertionsJson) {
    return [];
  }

  try {
    const assertions = JSON.parse(assertionsJson) as Array<{
      type: string;
      compare: string;
      target: string;
      record?: string;
    }>;

    return assertions
      .filter((a) => a.type === "dns" || a.record)
      .map((a) => ({
        $typeName: "openstatus.monitor.v1.RecordAssertion" as const,
        record: a.record ?? "",
        target: String(a.target),
        comparator: compareToRecordComparator(a.compare),
      }));
  } catch (error) {
    console.error("[monitor-utils] Failed to parse DNS assertions JSON:", error);
    return [];
  }
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

/**
 * Transform database HTTP monitor to proto HTTPMonitor.
 */
export function dbMonitorToHttpProto(dbMon: Monitor): HTTPMonitor {
  const assertions = parseHttpAssertions(dbMon.assertions);

  return {
    $typeName: "openstatus.monitor.v1.HTTPMonitor",
    id: String(dbMon.id),
    name: dbMon.name,
    url: dbMon.url,
    periodicity: dbMon.periodicity,
    method: dbMon.method?.toUpperCase() ?? "GET",
    body: dbMon.body ?? "",
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(dbMon.retry ?? MONITOR_DEFAULTS.retry),
    followRedirects: dbMon.followRedirects ?? MONITOR_DEFAULTS.followRedirects,
    headers: toProtoHeaders(dbMon.headers),
    statusCodeAssertions: assertions.statusCodeAssertions,
    bodyAssertions: assertions.bodyAssertions,
    headerAssertions: assertions.headerAssertions,
    description: dbMon.description,
    active: dbMon.active ?? MONITOR_DEFAULTS.active,
    public: dbMon.public ?? MONITOR_DEFAULTS.public,
    regions: dbMon.regions,
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
  };
}

/**
 * Transform database TCP monitor to proto TCPMonitor.
 */
export function dbMonitorToTcpProto(dbMon: Monitor): TCPMonitor {
  return {
    $typeName: "openstatus.monitor.v1.TCPMonitor",
    id: String(dbMon.id),
    name: dbMon.name,
    uri: dbMon.url,
    periodicity: dbMon.periodicity,
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(dbMon.retry ?? MONITOR_DEFAULTS.retry),
    description: dbMon.description,
    active: dbMon.active ?? MONITOR_DEFAULTS.active,
    public: dbMon.public ?? MONITOR_DEFAULTS.public,
    regions: dbMon.regions,
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
  };
}

/**
 * Transform database DNS monitor to proto DNSMonitor.
 */
export function dbMonitorToDnsProto(dbMon: Monitor): DNSMonitor {
  return {
    $typeName: "openstatus.monitor.v1.DNSMonitor",
    id: String(dbMon.id),
    name: dbMon.name,
    uri: dbMon.url,
    periodicity: dbMon.periodicity,
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(dbMon.retry ?? MONITOR_DEFAULTS.retry),
    recordAssertions: parseDnsAssertions(dbMon.assertions),
    description: dbMon.description,
    active: dbMon.active ?? MONITOR_DEFAULTS.active,
    public: dbMon.public ?? MONITOR_DEFAULTS.public,
    regions: dbMon.regions,
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
  };
}

// ============================================================
// Proto to DB Conversion Functions (for writes)
// ============================================================

/**
 * Convert NumberComparator to database compare string.
 */
export function numberComparatorToString(comp: NumberComparator): string {
  switch (comp) {
    case NumberComparator.EQUAL:
      return "eq";
    case NumberComparator.NOT_EQUAL:
      return "not_eq";
    case NumberComparator.GREATER_THAN:
      return "gt";
    case NumberComparator.GREATER_THAN_OR_EQUAL:
      return "gte";
    case NumberComparator.LESS_THAN:
      return "lt";
    case NumberComparator.LESS_THAN_OR_EQUAL:
      return "lte";
    default:
      return "eq";
  }
}

/**
 * Convert StringComparator to database compare string.
 */
export function stringComparatorToString(comp: StringComparator): string {
  switch (comp) {
    case StringComparator.EQUAL:
      return "eq";
    case StringComparator.NOT_EQUAL:
      return "not_eq";
    case StringComparator.CONTAINS:
      return "contains";
    case StringComparator.NOT_CONTAINS:
      return "not_contains";
    case StringComparator.EMPTY:
      return "empty";
    case StringComparator.NOT_EMPTY:
      return "not_empty";
    case StringComparator.GREATER_THAN:
      return "gt";
    case StringComparator.GREATER_THAN_OR_EQUAL:
      return "gte";
    case StringComparator.LESS_THAN:
      return "lt";
    case StringComparator.LESS_THAN_OR_EQUAL:
      return "lte";
    default:
      return "eq";
  }
}

/**
 * Convert RecordComparator to database compare string.
 */
export function recordComparatorToString(comp: RecordComparator): string {
  switch (comp) {
    case RecordComparator.EQUAL:
      return "eq";
    case RecordComparator.NOT_EQUAL:
      return "not_eq";
    case RecordComparator.CONTAINS:
      return "contains";
    case RecordComparator.NOT_CONTAINS:
      return "not_contains";
    default:
      return "eq";
  }
}

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
 * Convert HTTP monitor proto assertions to database JSON string.
 */
export function httpAssertionsToDbJson(
  statusCodeAssertions: StatusCodeAssertion[],
  bodyAssertions: BodyAssertion[],
  headerAssertions: HeaderAssertion[],
): string | undefined {
  const assertions: Array<{
    type: string;
    compare: string;
    target: string | number;
    key?: string;
  }> = [];

  for (const s of statusCodeAssertions) {
    assertions.push({
      type: "status",
      compare: numberComparatorToString(s.comparator),
      target: Number(s.target),
    });
  }

  for (const b of bodyAssertions) {
    assertions.push({
      type: "textBody",
      compare: stringComparatorToString(b.comparator),
      target: b.target,
    });
  }

  for (const h of headerAssertions) {
    assertions.push({
      type: "header",
      compare: stringComparatorToString(h.comparator),
      target: h.target,
      key: h.key,
    });
  }

  return assertions.length > 0 ? JSON.stringify(assertions) : undefined;
}

/**
 * Convert DNS monitor proto assertions to database JSON string.
 */
export function dnsAssertionsToDbJson(
  recordAssertions: RecordAssertion[],
): string | undefined {
  if (recordAssertions.length === 0) {
    return undefined;
  }

  const assertions = recordAssertions.map((a) => ({
    type: "dns",
    compare: recordComparatorToString(a.comparator),
    target: a.target,
    record: a.record,
  }));

  return JSON.stringify(assertions);
}

/**
 * Convert regions array to database string format.
 */
export function regionsToDbString(regions: string[]): string {
  return regions.join(",");
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
