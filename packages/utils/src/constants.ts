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
  "udp",
  "dns",
  "ssl",
] as const;
