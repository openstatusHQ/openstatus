import {
  type HTTPResponseLogDetail,
  type HTTPResponseLogListItem,
  HTTPResponseLogRequestStatus,
  type HTTPResponseLogTiming,
  HTTPResponseLogTrigger,
} from "@openstatus/proto/monitor/v1";
import { stringToRegion } from "./converters";

const REDACTED = "[redacted]";
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);
const SENSITIVE_HEADER_PARTS = [
  "auth",
  "cookie",
  "credential",
  "key",
  "secret",
  "session",
  "token",
];

type TinybirdTiming = {
  dns: number;
  connect: number;
  tls: number;
  ttfb: number;
  transfer: number;
} | null;

type TinybirdHTTPResponseLogListItem = {
  id: string | null;
  latency: number;
  statusCode: number | null;
  monitorId: string;
  requestStatus: "error" | "success" | "degraded" | null;
  region: string;
  cronTimestamp: number;
  trigger: "cron" | "api" | null;
  timestamp: number;
  timing: TinybirdTiming;
};

type TinybirdHTTPResponseLogDetail = TinybirdHTTPResponseLogListItem & {
  url: string;
  error: boolean;
  message: string | null;
  headers: Record<string, string> | null;
  assertions: string | null;
};

function isSensitiveHeader(name: string) {
  const normalized = name.toLowerCase();
  return (
    SENSITIVE_HEADER_NAMES.has(normalized) ||
    SENSITIVE_HEADER_PARTS.some((part) => normalized.includes(part))
  );
}

export function redactSensitiveHeaders(headers: Record<string, string> | null) {
  if (!headers) return {};

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeader(name) ? REDACTED : value,
    ]),
  );
}

function toHTTPResponseLogRequestStatus(
  status: TinybirdHTTPResponseLogListItem["requestStatus"],
) {
  switch (status) {
    case "success":
      return HTTPResponseLogRequestStatus.HTTP_RESPONSE_LOG_REQUEST_STATUS_SUCCESS;
    case "error":
      return HTTPResponseLogRequestStatus.HTTP_RESPONSE_LOG_REQUEST_STATUS_ERROR;
    case "degraded":
      return HTTPResponseLogRequestStatus.HTTP_RESPONSE_LOG_REQUEST_STATUS_DEGRADED;
    default:
      return HTTPResponseLogRequestStatus.HTTP_RESPONSE_LOG_REQUEST_STATUS_UNSPECIFIED;
  }
}

function toHTTPResponseLogTrigger(
  trigger: TinybirdHTTPResponseLogListItem["trigger"],
) {
  switch (trigger) {
    case "cron":
      return HTTPResponseLogTrigger.HTTP_RESPONSE_LOG_TRIGGER_CRON;
    case "api":
      return HTTPResponseLogTrigger.HTTP_RESPONSE_LOG_TRIGGER_API;
    default:
      return HTTPResponseLogTrigger.HTTP_RESPONSE_LOG_TRIGGER_UNSPECIFIED;
  }
}

function toHTTPResponseLogTiming(
  timing: TinybirdTiming,
): HTTPResponseLogTiming | undefined {
  if (!timing) return undefined;

  return {
    $typeName: "openstatus.monitor.v1.HTTPResponseLogTiming",
    dns: timing.dns,
    connect: timing.connect,
    tls: timing.tls,
    ttfb: timing.ttfb,
    transfer: timing.transfer,
  };
}

export function toHTTPResponseLogListItem(
  log: TinybirdHTTPResponseLogListItem,
): HTTPResponseLogListItem {
  return {
    $typeName: "openstatus.monitor.v1.HTTPResponseLogListItem",
    id: log.id ?? undefined,
    latency: log.latency,
    statusCode: log.statusCode ?? undefined,
    monitorId: log.monitorId,
    requestStatus: toHTTPResponseLogRequestStatus(log.requestStatus),
    region: stringToRegion(log.region),
    cronTimestamp: BigInt(log.cronTimestamp),
    trigger: toHTTPResponseLogTrigger(log.trigger),
    timestamp: BigInt(log.timestamp),
    timing: toHTTPResponseLogTiming(log.timing),
  };
}

export function toHTTPResponseLogDetail(
  log: TinybirdHTTPResponseLogDetail,
): HTTPResponseLogDetail {
  return {
    $typeName: "openstatus.monitor.v1.HTTPResponseLogDetail",
    log: toHTTPResponseLogListItem(log),
    url: log.url,
    error: log.error,
    message: log.message ?? undefined,
    headers: redactSensitiveHeaders(log.headers),
    assertions: log.assertions ?? undefined,
  };
}
