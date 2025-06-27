export const auditLogs = [
  {
    id: 3,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "incident.created" as const,
  },
  {
    id: 2,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.failed" as const,
    metadata: {
      region: "ams",
      status: 500,
      latency: 1400,
    } as const,
  },
  {
    id: 1,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "notification.sent" as const,
    metadata: {
      provider: "slack",
    } as const,
  },
  {
    id: 0,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.recovered" as const,
    metadata: {
      region: "ams",
      latency: 140,
    } as const,
  },
  {
    id: -1,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.degraded" as const,
    metadata: {
      region: "ams",
      latency: 30_000,
    } as const,
  },
  {
    id: -2,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "incident.resolved" as const,
  },
  {
    id: -3,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "incident.created" as const,
  },
  {
    id: -4,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.degraded" as const,
    metadata: {
      region: "ams",
      latency: 30_000,
    } as const,
  },
  {
    id: -5,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.degraded" as const,
    metadata: {
      region: "ams",
      latency: 32_000,
    } as const,
  },
  {
    id: -6,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.degraded" as const,
    metadata: {
      region: "ams",
      latency: 33_000,
    } as const,
  },
  {
    id: -7,
    timestamp: new Date("2025-05-05 12:00:00"),
    action: "monitor.degraded" as const,
    metadata: {
      region: "ams",
      latency: 34_000,
    } as const,
  },
];
export type AuditLog = (typeof auditLogs)[number];
