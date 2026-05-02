import {
  type ResponseLogDetail,
  type ResponseLogListItem,
  ResponseLogRequestStatus,
  type ResponseLogTiming,
  ResponseLogTrigger,
} from "@openstatus/proto/monitor/v1";

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

type TinybirdResponseLogListItem = {
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

type TinybirdResponseLogDetail = TinybirdResponseLogListItem & {
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

function toResponseLogRequestStatus(
  status: TinybirdResponseLogListItem["requestStatus"],
) {
  switch (status) {
    case "success":
      return ResponseLogRequestStatus.SUCCESS;
    case "error":
      return ResponseLogRequestStatus.ERROR;
    case "degraded":
      return ResponseLogRequestStatus.DEGRADED;
    default:
      return ResponseLogRequestStatus.UNSPECIFIED;
  }
}

function toResponseLogTrigger(trigger: TinybirdResponseLogListItem["trigger"]) {
  switch (trigger) {
    case "cron":
      return ResponseLogTrigger.CRON;
    case "api":
      return ResponseLogTrigger.API;
    default:
      return ResponseLogTrigger.UNSPECIFIED;
  }
}

function toResponseLogTiming(
  timing: TinybirdTiming,
): ResponseLogTiming | undefined {
  if (!timing) return undefined;

  return {
    $typeName: "openstatus.monitor.v1.ResponseLogTiming",
    dns: timing.dns,
    connect: timing.connect,
    tls: timing.tls,
    ttfb: timing.ttfb,
    transfer: timing.transfer,
  };
}

export function toResponseLogListItem(
  log: TinybirdResponseLogListItem,
): ResponseLogListItem {
  return {
    $typeName: "openstatus.monitor.v1.ResponseLogListItem",
    id: log.id ?? undefined,
    latency: log.latency,
    statusCode: log.statusCode ?? undefined,
    monitorId: log.monitorId,
    requestStatus: toResponseLogRequestStatus(log.requestStatus),
    region: log.region,
    cronTimestamp: BigInt(log.cronTimestamp),
    trigger: toResponseLogTrigger(log.trigger),
    timestamp: BigInt(log.timestamp),
    timing: toResponseLogTiming(log.timing),
  };
}

export function toResponseLogDetail(
  log: TinybirdResponseLogDetail,
): ResponseLogDetail {
  return {
    $typeName: "openstatus.monitor.v1.ResponseLogDetail",
    log: toResponseLogListItem(log),
    url: log.url,
    error: log.error,
    message: log.message ?? undefined,
    headers: redactSensitiveHeaders(log.headers),
    assertions: log.assertions ?? undefined,
  };
}
