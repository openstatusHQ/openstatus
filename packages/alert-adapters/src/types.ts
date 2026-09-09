export const alertStatuses = ["firing", "resolved"] as const;
export type AlertStatus = (typeof alertStatuses)[number];

export const alertSeverities = ["critical", "warning", "info"] as const;
export type AlertSeverity = (typeof alertSeverities)[number];

export type IngestedAlert = {
  externalId?: string;
  title: string;
  description?: string;
  status: AlertStatus;
  severity: AlertSeverity;
  startsAt?: Date;
  labels: Record<string, string>;
  url?: string;
};

export type AlertAdapter = {
  id: string;
  parseBody: (raw: string, contentType: string | null) => unknown;
  /**
   * The provider's own group identity — Alertmanager `groupKey`, Grafana rule
   * UID. Null when the payload carries none, which degrades dedup to a
   * heuristic key.
   */
  groupKey: (body: unknown) => string | null;
  formatAlerts: (body: unknown) => IngestedAlert[];
};
