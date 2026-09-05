import { Code, ConnectError } from "@connectrpc/connect";
import { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import { monitorMethods } from "@openstatus/db/src/schema/monitors/constants";
import type { Periodicity, Region } from "@openstatus/proto/monitor/v1";
import type { UpdateMonitorConfigInput } from "@openstatus/services/monitor";

import {
  MONITOR_DEFAULTS,
  protoOpenTelemetryToService,
  periodicityToString,
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
export function validateCommonMonitorFields(mon: { regions?: Region[] }): void {
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
 * The bounds protovalidate enforces on a complete monitor message. Update RPCs
 * skip the interceptor — a partial patch cannot satisfy `min_len` on the fields
 * it omits — so nothing else checks these on an update: `updateMonitorConfig`
 * writes whatever it is handed straight to the column.
 *
 * Keep in sync with the `buf.validate` constraints in `*_monitor.proto`.
 */
const MONITOR_BOUNDS = {
  nameMaxLen: 256,
  uriMaxLen: 2048,
  descriptionMaxLen: 1024,
  timeoutMaxMs: 120_000,
  degradedAtMaxMs: 120_000,
  retryMax: 10,
  regionsMaxItems: 28,
  serviceMaxLen: 512,
  // gRPC dials a host:port; a portless target or one carrying a scheme cannot
  // be dialled and would surface as a bare UNAVAILABLE.
  hostPortPattern: /^(\[[0-9a-fA-F:]+\]|[^:/\s]+):[0-9]{1,5}$/,
} as const;

function invalidArgument(message: string): never {
  throw new ConnectError(message, Code.InvalidArgument);
}

/**
 * Apply those bounds to whatever an update actually supplied. The "supplied"
 * tests mirror `getCommonUpdateInput` exactly: a field this skips is a field
 * that never reaches the database.
 */
export function validateMonitorPatchBounds(
  mon: {
    name?: string;
    uri?: string;
    url?: string;
    timeout?: bigint;
    degradedAt?: bigint;
    retry?: bigint;
    description?: string;
    regions?: Region[];
    service?: string;
  },
  opts: { jobType?: "http" | "tcp" | "dns" | "icmp" | "grpc" } = {},
): void {
  if (mon.name !== undefined && mon.name !== "") {
    if (mon.name.length > MONITOR_BOUNDS.nameMaxLen) {
      invalidArgument(
        `monitor.name: must be at most ${MONITOR_BOUNDS.nameMaxLen} characters [string.max_len]`,
      );
    }
  }

  // HTTP calls it `url`, the other three call it `uri`.
  const target = mon.uri ?? mon.url;
  if (target !== undefined && target !== "") {
    if (target.length > MONITOR_BOUNDS.uriMaxLen) {
      invalidArgument(
        `monitor.uri: must be at most ${MONITOR_BOUNDS.uriMaxLen} characters [string.max_len]`,
      );
    }
  }

  if (mon.service !== undefined) {
    if (mon.service.length > MONITOR_BOUNDS.serviceMaxLen) {
      invalidArgument(
        `monitor.service: must be at most ${MONITOR_BOUNDS.serviceMaxLen} characters [string.max_len]`,
      );
    }
  }

  // gRPC only: the other types accept a bare hostname or a URL. Checked on the
  // job type rather than on `service` being present, so a patch that changes
  // only the target is still validated.
  if (opts.jobType === "grpc" && target !== undefined && target !== "") {
    if (!MONITOR_BOUNDS.hostPortPattern.test(target)) {
      invalidArgument(
        "monitor.uri: must match the host:port format [string.pattern]",
      );
    }
  }

  if (mon.description !== undefined) {
    if (mon.description.length > MONITOR_BOUNDS.descriptionMaxLen) {
      invalidArgument(
        `monitor.description: must be at most ${MONITOR_BOUNDS.descriptionMaxLen} characters [string.max_len]`,
      );
    }
  }

  if (mon.timeout !== undefined && mon.timeout !== BigInt(0)) {
    if (
      mon.timeout < BigInt(0) ||
      mon.timeout > BigInt(MONITOR_BOUNDS.timeoutMaxMs)
    ) {
      invalidArgument(
        `monitor.timeout: must be between 0 and ${MONITOR_BOUNDS.timeoutMaxMs} [int64.gte_lte]`,
      );
    }
  }

  if (mon.degradedAt !== undefined) {
    if (
      mon.degradedAt < BigInt(0) ||
      mon.degradedAt > BigInt(MONITOR_BOUNDS.degradedAtMaxMs)
    ) {
      invalidArgument(
        `monitor.degraded_at: must be between 0 and ${MONITOR_BOUNDS.degradedAtMaxMs} [int64.gte_lte]`,
      );
    }
  }

  if (mon.retry !== undefined && mon.retry !== BigInt(0)) {
    if (mon.retry < BigInt(0) || mon.retry > BigInt(MONITOR_BOUNDS.retryMax)) {
      invalidArgument(
        `monitor.retry: must be between 0 and ${MONITOR_BOUNDS.retryMax} [int64.gte_lte]`,
      );
    }
  }

  if (
    mon.regions !== undefined &&
    mon.regions.length > MONITOR_BOUNDS.regionsMaxItems
  ) {
    invalidArgument(
      `monitor.regions: must contain at most ${MONITOR_BOUNDS.regionsMaxItems} items [repeated.max_items]`,
    );
  }
}

/**
 * Extract the fields every monitor type shares, in the shape
 * `createMonitor` takes. Defaults are applied here rather than left to
 * the column defaults so the API contract stays explicit.
 */
export function getCommonCreateInput(mon: {
  name: string;
  periodicity?: Periodicity;
  timeout?: bigint;
  degradedAt?: bigint;
  active?: boolean;
  description?: string;
  public?: boolean;
  regions?: Region[];
  retry?: bigint;
  openTelemetry?: Parameters<typeof protoOpenTelemetryToService>[0];
}) {
  const otelConfig = protoOpenTelemetryToService(mon.openTelemetry);

  const periodicityStr = mon.periodicity
    ? periodicityToString(mon.periodicity)
    : undefined;

  return {
    name: mon.name,
    periodicity: toValidPeriodicity(periodicityStr),
    timeout: mon.timeout ? Number(mon.timeout) : MONITOR_DEFAULTS.timeout,
    degradedAfter: mon.degradedAt ? Number(mon.degradedAt) : undefined,
    active: mon.active ?? MONITOR_DEFAULTS.active,
    description: mon.description || MONITOR_DEFAULTS.description,
    public: mon.public ?? MONITOR_DEFAULTS.public,
    // Always a concrete list (possibly empty) — passing `undefined` would
    // hand the service its plan-based random-region fallback, which the
    // API has never done.
    regions: mon.regions ? regionsToStrings(mon.regions) : [],
    retry: mon.retry ? Number(mon.retry) : MONITOR_DEFAULTS.retry,
    otelEndpoint: otelConfig.otelEndpoint,
    otelHeaders: otelConfig.otelHeaders,
  };
}

/**
 * Same, for partial updates: only fields the caller actually provided,
 * so `updateMonitorConfig` leaves the rest untouched.
 */
export function getCommonUpdateInput(mon: {
  name?: string;
  periodicity?: Periodicity;
  timeout?: bigint;
  degradedAt?: bigint;
  active?: boolean;
  description?: string;
  public?: boolean;
  regions?: Region[];
  retry?: bigint;
  openTelemetry?: Parameters<typeof protoOpenTelemetryToService>[0];
}): Omit<UpdateMonitorConfigInput, "id"> {
  const result: Omit<UpdateMonitorConfigInput, "id"> = {};

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

  // `active`, `public` and `description` have explicit presence in the proto,
  // so `undefined` means omitted and an explicit false/"" is applied.
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
    result.regions = regionsToStrings(mon.regions);
  }

  if (mon.retry !== undefined && mon.retry !== BigInt(0)) {
    result.retry = Number(mon.retry);
  }

  if (mon.openTelemetry !== undefined) {
    const otelConfig = protoOpenTelemetryToService(mon.openTelemetry);
    result.otelEndpoint = otelConfig.otelEndpoint;
    result.otelHeaders = otelConfig.otelHeaders;
  }

  return result;
}
