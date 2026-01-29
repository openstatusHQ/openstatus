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
 * Note: name, url/uri, and periodicity are validated by protovalidate interceptor.
 * Throws ConnectError if validation fails.
 */
export function validateCommonMonitorFields(mon: {
  regions?: Region[];
}): void {
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

/**
 * Extract common database values for update operations.
 * Only includes fields that are explicitly provided (not undefined).
 * This enables partial updates where only specified fields are changed.
 */
export function getCommonDbValuesForUpdate(mon: {
  name?: string;
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
  const result: Record<string, unknown> = {};

  if (mon.name !== undefined && mon.name !== "") {
    result.name = mon.name;
  }

  if (mon.periodicity !== undefined && mon.periodicity !== 0) {
    const periodicityStr = periodicityToString(mon.periodicity);
    result.periodicity = toValidPeriodicity(periodicityStr);
  }

  if (mon.timeout !== undefined && mon.timeout !== BigInt(0)) {
    result.timeout = Number(mon.timeout);
  }

  if (mon.degradedAt !== undefined) {
    result.degradedAfter = Number(mon.degradedAt);
  }

  if (mon.active !== undefined) {
    result.active = mon.active;
  }

  if (mon.description !== undefined) {
    result.description = mon.description;
  }

  if (mon.public !== undefined) {
    result.public = mon.public;
  }

  if (mon.regions !== undefined && mon.regions.length > 0) {
    const regionStrings = regionsToStrings(mon.regions);
    result.regions = regionsToDbString(regionStrings);
  }

  if (mon.retry !== undefined && mon.retry !== BigInt(0)) {
    result.retry = Number(mon.retry);
  }

  if (mon.openTelemetry !== undefined) {
    const otelConfig = openTelemetryToDb(mon.openTelemetry);
    result.otelEndpoint = otelConfig.otelEndpoint;
    result.otelHeaders = otelConfig.otelHeaders;
  }

  return result;
}
