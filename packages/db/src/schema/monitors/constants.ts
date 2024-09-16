export const monitorMethods = ["GET", "POST", "HEAD"] as const;
export const monitorStatus = ["active", "error", "degraded"] as const;

export const monitorJobTypes = [
  "http",
  "tcp",
  "imcp",
  "udp",
  "dns",
  "ssl",
] as const;
