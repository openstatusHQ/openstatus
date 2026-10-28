export const MONITOR_METHODS = [
  "GET",
  "POST",
  "HEAD",
  "PUT",
  "PATCH",
  "DELETE",
  "TRACE",
  "CONNECT",
  "OPTIONS",
] as const;

export const MONITOR_STATUSES = ["active", "error", "degraded"] as const;

export const MONITOR_JOB_TYPES = [
  "http",
  "tcp",
  "icmp",
  "grpc",
  "udp",
  "dns",
  "ssl",
  "heartbeat",
] as const;

// seconds
export const HEARTBEAT_PERIOD_RANGE = { min: 60, max: 2_592_000 } as const;
export const HEARTBEAT_GRACE_RANGE = { min: 60, max: 604_800 } as const;
