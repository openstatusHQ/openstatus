import {
  HTTPMethod,
  MonitorStatus,
  Periodicity,
  TimeRange,
} from "@openstatus/proto/monitor/v1";

import type { monitorPeriodicitySchema } from "@openstatus/db/src/schema/constants";
import type { z } from "zod";

// ============================================================
// Periodicity Conversions
// ============================================================

const DB_TO_PERIODICITY: Record<string, Periodicity> = {
  "30s": Periodicity.PERIODICITY_30S,
  "1m": Periodicity.PERIODICITY_1M,
  "5m": Periodicity.PERIODICITY_5M,
  "10m": Periodicity.PERIODICITY_10M,
  "30m": Periodicity.PERIODICITY_30M,
  "1h": Periodicity.PERIODICITY_1H,
};

const PERIODICITY_TO_DB: Record<
  Periodicity,
  z.infer<typeof monitorPeriodicitySchema>
> = {
  [Periodicity.PERIODICITY_30S]: "30s",
  [Periodicity.PERIODICITY_1M]: "1m",
  [Periodicity.PERIODICITY_5M]: "5m",
  [Periodicity.PERIODICITY_10M]: "10m",
  [Periodicity.PERIODICITY_30M]: "30m",
  [Periodicity.PERIODICITY_1H]: "1h",
  [Periodicity.PERIODICITY_UNSPECIFIED]: "1m",
};

export function stringToPeriodicity(value: string): Periodicity {
  return DB_TO_PERIODICITY[value] ?? Periodicity.PERIODICITY_UNSPECIFIED;
}

export function periodicityToString(value: Periodicity) {
  return PERIODICITY_TO_DB[value] ?? "1m";
}

// ============================================================
// HTTP Method Conversions
// ============================================================

const DB_TO_HTTP_METHOD: Record<string, HTTPMethod> = {
  GET: HTTPMethod.HTTP_METHOD_GET,
  POST: HTTPMethod.HTTP_METHOD_POST,
  HEAD: HTTPMethod.HTTP_METHOD_HEAD,
  PUT: HTTPMethod.HTTP_METHOD_PUT,
  PATCH: HTTPMethod.HTTP_METHOD_PATCH,
  DELETE: HTTPMethod.HTTP_METHOD_DELETE,
  TRACE: HTTPMethod.HTTP_METHOD_TRACE,
  CONNECT: HTTPMethod.HTTP_METHOD_CONNECT,
  OPTIONS: HTTPMethod.HTTP_METHOD_OPTIONS,
};

const HTTP_METHOD_TO_DB: Record<HTTPMethod, string> = {
  [HTTPMethod.HTTP_METHOD_GET]: "GET",
  [HTTPMethod.HTTP_METHOD_POST]: "POST",
  [HTTPMethod.HTTP_METHOD_HEAD]: "HEAD",
  [HTTPMethod.HTTP_METHOD_PUT]: "PUT",
  [HTTPMethod.HTTP_METHOD_PATCH]: "PATCH",
  [HTTPMethod.HTTP_METHOD_DELETE]: "DELETE",
  [HTTPMethod.HTTP_METHOD_TRACE]: "TRACE",
  [HTTPMethod.HTTP_METHOD_CONNECT]: "CONNECT",
  [HTTPMethod.HTTP_METHOD_OPTIONS]: "OPTIONS",
  [HTTPMethod.HTTP_METHOD_UNSPECIFIED]: "GET",
};

export function stringToHttpMethod(value: string | undefined): HTTPMethod {
  return (
    DB_TO_HTTP_METHOD[value?.toUpperCase() ?? ""] ??
    HTTPMethod.HTTP_METHOD_UNSPECIFIED
  );
}

export function httpMethodToString(value: HTTPMethod): string {
  return HTTP_METHOD_TO_DB[value] ?? "GET";
}

// ============================================================
// Monitor Status Conversions
// ============================================================

const DB_TO_MONITOR_STATUS: Record<string, MonitorStatus> = {
  active: MonitorStatus.ACTIVE,
  degraded: MonitorStatus.DEGRADED,
  error: MonitorStatus.ERROR,
};

export function stringToMonitorStatus(value: string): MonitorStatus {
  return DB_TO_MONITOR_STATUS[value] ?? MonitorStatus.UNSPECIFIED;
}

// ============================================================
// Time Range Conversions
// ============================================================

export type TimeRangeKey = "1d" | "7d" | "14d";

const TIME_RANGE_TO_KEY: Record<TimeRange, TimeRangeKey> = {
  [TimeRange.TIME_RANGE_1D]: "1d",
  [TimeRange.TIME_RANGE_7D]: "7d",
  [TimeRange.TIME_RANGE_14D]: "14d",
  [TimeRange.TIME_RANGE_UNSPECIFIED]: "1d",
};

export function timeRangeToKey(value: TimeRange): TimeRangeKey {
  return TIME_RANGE_TO_KEY[value] ?? "1d";
}
