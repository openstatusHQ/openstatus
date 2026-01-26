import type { Monitor } from "@openstatus/db/src/schema/monitors/validation";
import type {
  DNSMonitor,
  HTTPMonitor,
  TCPMonitor,
} from "@openstatus/proto/monitor/v1";

import { parseDnsAssertions, parseHttpAssertions } from "./assertions";
import { MONITOR_DEFAULTS } from "./defaults";
import {
  stringToHttpMethod,
  stringToMonitorStatus,
  stringToPeriodicity,
} from "./enums";
import { parseOpenTelemetry, toProtoHeaders } from "./headers";
import { stringsToRegions } from "./regions";

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
    periodicity: stringToPeriodicity(dbMon.periodicity),
    method: stringToHttpMethod(dbMon.method),
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
    regions: stringsToRegions(dbMon.regions),
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
    status: stringToMonitorStatus(dbMon.status),
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
    periodicity: stringToPeriodicity(dbMon.periodicity),
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(dbMon.retry ?? MONITOR_DEFAULTS.retry),
    description: dbMon.description,
    active: dbMon.active ?? MONITOR_DEFAULTS.active,
    public: dbMon.public ?? MONITOR_DEFAULTS.public,
    regions: stringsToRegions(dbMon.regions),
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
    status: stringToMonitorStatus(dbMon.status),
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
    periodicity: stringToPeriodicity(dbMon.periodicity),
    timeout: BigInt(dbMon.timeout),
    degradedAt: dbMon.degradedAfter ? BigInt(dbMon.degradedAfter) : undefined,
    retry: BigInt(dbMon.retry ?? MONITOR_DEFAULTS.retry),
    recordAssertions: parseDnsAssertions(dbMon.assertions),
    description: dbMon.description,
    active: dbMon.active ?? MONITOR_DEFAULTS.active,
    public: dbMon.public ?? MONITOR_DEFAULTS.public,
    regions: stringsToRegions(dbMon.regions),
    openTelemetry: parseOpenTelemetry(dbMon.otelEndpoint, dbMon.otelHeaders),
    status: stringToMonitorStatus(dbMon.status),
  };
}
