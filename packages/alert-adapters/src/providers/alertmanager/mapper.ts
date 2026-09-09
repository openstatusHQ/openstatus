import type { AlertSeverity, AlertStatus, IngestedAlert } from "../../types";
import type { AlertmanagerAlert, AlertmanagerPayload } from "./api-types";

const SEVERITY: Record<string, AlertSeverity> = {
  critical: "critical",
  error: "critical",
  page: "critical",
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

function title(alert: AlertmanagerAlert): string {
  return (
    alert.annotations.summary ??
    alert.annotations.title ??
    alert.labels.alertname ??
    "Alert"
  );
}

export function mapAlert(alert: AlertmanagerAlert): IngestedAlert {
  const startsAt = alert.startsAt ? new Date(alert.startsAt) : undefined;
  return {
    externalId: alert.fingerprint,
    title: title(alert),
    description: alert.annotations.description,
    status: mapStatus(alert.status),
    severity: mapSeverity(alert.labels.severity),
    startsAt:
      startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : undefined,
    labels: alert.labels,
    url: alert.generatorURL,
  };
}

export function mapPayload(payload: AlertmanagerPayload): IngestedAlert[] {
  // A group-level resolved notification still lists its member alerts, so the
  // per-alert status is authoritative and the group status is the fallback.
  return payload.alerts.map((alert) => ({
    ...mapAlert(alert),
    status: mapStatus(alert.status || payload.status),
  }));
}
