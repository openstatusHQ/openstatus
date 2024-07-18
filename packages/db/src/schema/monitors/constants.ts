export const monitorMethods = ["GET", "POST", "HEAD"] as const;
export const monitorStatus = ["active", "error", "degraded"] as const;

export const monitorJobTypes = ["website", "cron", "other"] as const;
