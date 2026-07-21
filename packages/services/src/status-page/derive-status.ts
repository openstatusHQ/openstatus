/**
 * Wire format of the public `/public/status/:slug` endpoint, consumed by the
 * published `@openstatus/react` widget and the status-page badges.
 */
// DO NOT CHANGE! Values are a public contract — changing one breaks every
// embedded badge and StatusWidget in the wild.
export enum Status {
  Operational = "operational",
  DegradedPerformance = "degraded_performance",
  PartialOutage = "partial_outage",
  MajorOutage = "major_outage",
  UnderMaintenance = "under_maintenance",
  Unknown = "unknown",
  Incident = "incident",
}

// Deliberately excludes "monitoring": a report being monitored is not treated
// as ongoing here. Diverges from ACTIVE_REPORT_STATUSES in page/get-content.ts,
// which includes it — do not unify without changing the public payload.
const ONGOING_REPORT_STATUSES: readonly string[] = [
  "investigating",
  "identified",
];

export type DerivePageStatusInput = {
  maintenances: { from: Date; to: Date }[];
  statusReports: { status: string }[];
  incidents: { resolvedAt: Date | null }[];
  now?: Date;
};

/**
 * Worst-first precedence over a page's manual events. Pure — the DB read lives
 * in `currentStatus`. No uptime data participates, so the branch that could
 * yield PartialOutage / MajorOutage always resolves Operational.
 */
export function derivePageStatus(input: DerivePageStatusInput): Status {
  const now = input.now ?? new Date();

  const hasOngoingMaintenance = input.maintenances.some(
    (m) => m.from.getTime() <= now.getTime() && m.to.getTime() >= now.getTime(),
  );
  if (hasOngoingMaintenance) return Status.UnderMaintenance;

  const hasOngoingReport = input.statusReports.some((report) =>
    ONGOING_REPORT_STATUSES.includes(report.status),
  );
  if (hasOngoingReport) return Status.DegradedPerformance;

  const hasOngoingIncident = input.incidents.some(
    (incident) => !incident.resolvedAt,
  );
  if (hasOngoingIncident) return Status.Incident;

  return Status.Operational;
}
