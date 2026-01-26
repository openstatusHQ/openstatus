import { Code, ConnectError } from "@connectrpc/connect";
import { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import { monitorMethods } from "@openstatus/db/src/schema/monitors/constants";
import type { Periodicity, Region } from "@openstatus/proto/monitor/v1";

import {
  MONITOR_DEFAULTS,
  openTelemetryToDb,
  periodicityToString,
  regionsToDbString,
  regionsToStrings,
  validateRegions,
} from "./converters";

type MonitorPeriodicity = (typeof monitorPeriodicity)[number];
type MonitorMethod = (typeof monitorMethods)[number];

/**
 * Validate and convert periodicity string to enum type.
 */
export function toValidPeriodicity(
  value: string | undefined,
): MonitorPeriodicity {
  const valid = monitorPeriodicity as readonly string[];
  if (value && valid.includes(value)) {
    return value as MonitorPeriodicity;
  }
  return "1m";
}

/**
 * Validate and convert method string to enum type.
 */
export function toValidMethod(value: string | undefined): MonitorMethod {
  const upper = value?.toUpperCase();
  const valid = monitorMethods as readonly string[];
  if (upper && valid.includes(upper)) {
    return upper as MonitorMethod;
  }
  return "GET";
}

/**
 * Validate required monitor fields common to all monitor types.
 * Throws ConnectError if validation fails.
 */
export function validateCommonMonitorFields(mon: {
  name?: string;
  regions?: Region[];
}): void {
  if (!mon.name || mon.name.trim().length === 0) {
    throw new ConnectError("Monitor name is required", Code.InvalidArgument);
  }

  if (mon.regions && mon.regions.length > 0) {
    const regionStrings = regionsToStrings(mon.regions);
    const invalidRegions = validateRegions(regionStrings);
    if (invalidRegions.length > 0) {
      throw new ConnectError(
        `Invalid regions: ${invalidRegions.join(", ")}`,
        Code.InvalidArgument,
      );
    }
  }
}

/**
 * Extract common database values for all monitor types.
 */
export function getCommonDbValues(mon: {
  name: string;
  periodicity?: Periodicity;
  timeout?: bigint;
  degradedAt?: bigint;
  active?: boolean;
  description?: string;
  public?: boolean;
  regions?: Region[];
  retry?: bigint;
  openTelemetry?: Parameters<typeof openTelemetryToDb>[0];
}) {
  const otelConfig = openTelemetryToDb(mon.openTelemetry);

  const periodicityStr = mon.periodicity
    ? periodicityToString(mon.periodicity)
    : undefined;
  const regionStrings = mon.regions ? regionsToStrings(mon.regions) : [];

  return {
    name: mon.name,
    periodicity: toValidPeriodicity(periodicityStr),
    timeout: mon.timeout ? Number(mon.timeout) : MONITOR_DEFAULTS.timeout,
    degradedAfter: mon.degradedAt ? Number(mon.degradedAt) : undefined,
    active: mon.active ?? MONITOR_DEFAULTS.active,
    description: mon.description || MONITOR_DEFAULTS.description,
    public: mon.public ?? MONITOR_DEFAULTS.public,
    regions: regionsToDbString(regionStrings),
    retry: mon.retry ? Number(mon.retry) : MONITOR_DEFAULTS.retry,
    otelEndpoint: otelConfig.otelEndpoint,
    otelHeaders: otelConfig.otelHeaders,
  };
}
