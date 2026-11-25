import type {
  MONITOR_JOB_TYPES,
  MONITOR_METHODS,
  MONITOR_STATUSES,
} from "./constants";
import { transformHeaders } from "./headers";
import type {
  DNSPayload,
  GRPC_TLS_MODES,
  GrpcPayload,
  HttpPayload,
  IcmpPayload,
  TcpPayload,
} from "./payloads";

type KeyValue = { key: string; value: string };

/** Job types the Go checker can run; anything else is rejected by `buildCheckerPayload`. */
const CHECKER_JOB_TYPES = ["http", "tcp", "dns", "icmp", "grpc"] as const;

export function isCheckerJobType(
  jobType: string,
): jobType is (typeof CHECKER_JOB_TYPES)[number] {
  return (CHECKER_JOB_TYPES as readonly string[]).includes(jobType);
}

/** The monitor fields the checker needs; a parsed `selectMonitorSchema` row satisfies it. */
export type CheckerMonitor = {
  id: number;
  workspaceId: number | null;
  jobType: (typeof MONITOR_JOB_TYPES)[number];
  url: string;
  method: (typeof MONITOR_METHODS)[number] | null;
  body: string | null;
  headers: KeyValue[];
  assertions: string | null;
  degradedAfter: number | null;
  timeout: number;
  retry: number | null;
  followRedirects: boolean | null;
  otelEndpoint: string | null;
  otelHeaders: KeyValue[];
  grpcService?: string | null;
  grpcTls?: (typeof GRPC_TLS_MODES)[number] | null;
};

export type CheckerPayload =
  | HttpPayload
  | TcpPayload
  | DNSPayload
  | IcmpPayload
  | GrpcPayload;

/** Builds the body the Go checker expects for one run of `monitor`. `timestamp` is in ms. */
export function buildCheckerPayload({
  monitor,
  status,
  trigger,
  timestamp,
}: {
  monitor: CheckerMonitor;
  status: (typeof MONITOR_STATUSES)[number];
  trigger: "cron" | "api";
  timestamp: number;
}): CheckerPayload {
  const common = {
    workspaceId: String(monitor.workspaceId),
    monitorId: String(monitor.id),
    status,
    cronTimestamp: timestamp,
    degradedAfter: monitor.degradedAfter,
    timeout: monitor.timeout,
    trigger,
    otelConfig: monitor.otelEndpoint
      ? {
          endpoint: monitor.otelEndpoint,
          headers: transformHeaders(monitor.otelHeaders),
        }
      : undefined,
    // The checker treats 0 as its own default of 3, so `??` and `||` agree on the wire.
    retry: monitor.retry ?? 3,
  };
  // Lazy: ICMP and gRPC ignore assertions, so a stale string must not fail their run.
  const assertions = () =>
    monitor.assertions ? JSON.parse(monitor.assertions) : null;

  switch (monitor.jobType) {
    case "http":
      return {
        ...common,
        url: monitor.url,
        method: monitor.method || "GET",
        body: monitor.body ?? undefined,
        headers: monitor.headers,
        assertions: assertions(),
        followRedirects: monitor.followRedirects ?? true,
      };
    case "tcp":
    case "dns":
      return { ...common, uri: monitor.url, assertions: assertions() };
    // ICMP and gRPC only report reachability / serving status: no assertions.
    case "icmp":
      return { ...common, uri: monitor.url };
    case "grpc":
      return {
        ...common,
        uri: monitor.url,
        service: monitor.grpcService ?? undefined,
        tls: monitor.grpcTls ?? "tls",
        headers: transformHeaders(monitor.headers),
      };
    default:
      throw new Error(`Invalid jobType '${monitor.jobType}'`);
  }
}
