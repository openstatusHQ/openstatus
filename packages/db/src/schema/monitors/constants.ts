export const monitorMethods = ["GET", "POST", "HEAD"] as const;
export const monitorStatus = ["active", "error", "degraded"] as const;

export const monitorJobTypes = [
  "http",
  "tcp",
  "imcp",
  "udp",
  "dns",
  "ssl",
  // FIXME: remove this after the migration
  "other",
] as const;
