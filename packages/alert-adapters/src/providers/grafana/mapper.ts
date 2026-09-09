import type { AlertSeverity, AlertStatus, IngestedAlert } from "../../types";
import type { GrafanaAlert, GrafanaPayload } from "./api-types";

const SEVERITY: Record<string, AlertSeverity> = {
  critical: "critical",
  error: "critical",
  warning: "warning",
  warn: "warning",
  info: "info",
  none: "info",
};

export function mapSeverity(raw: string | undefined): AlertSeverity {
  if (!raw) return "warning";
  return SEVERITY[raw.toLowerCase()] ?? "warning";
}

export function mapStatus(raw: string): AlertStatus {
  return raw.toLowerCase() === "resolved" ? "resolved" : "firing";
}

function title(alert: GrafanaAlert): string {
  return (
    alert.annotations.summary ??
    alert.labels.alertname ??
    alert.labels.rulename ??
    "Alert"
  );
}

export function mapAlert(alert: GrafanaAlert): IngestedAlert {
  const startsAt = alert.startsAt ? new Date(alert.startsAt) : undefined;
  return {
    externalId: alert.fingerprint,
    title: title(alert),
    description: alert.annotations.description ?? alert.valueString,
    status: mapStatus(alert.status),
    severity: mapSeverity(alert.labels.severity),
    startsAt:
      startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
    labels: alert.labels,
    url: alert.dashboardURL ?? alert.panelURL ?? alert.generatorURL,
  };
}

export function mapPayload(payload: GrafanaPayload): IngestedAlert[] {
  return payload.alerts.map((alert) => ({
    ...mapAlert(alert),
    status: mapStatus(alert.status || payload.status),
  }));
}
