import type { Incident, StatusReport } from "@openstatus/db/src/schema";

// DO NOT CHANGE!
export enum Status {
  Operational = "operational",
  DegradedPerformance = "degraded_performance",
  PartialOutage = "partial_outage",
  MajorOutage = "major_outage",
  UnderMaintenance = "under_maintenance",
  Unknown = "unknown",
  Incident = "incident",
}

// TODO: duplicate to `Status` enum above
export type StatusVariant =
  | "up"
  | "degraded"
  | "down"
  | "empty"
  | "incident"
  | "maintenance";

export type StatusDetails = {
  long: string;
  short: string;
  variant: StatusVariant;
};

/**
 * Data used for the `Bar` component within the `Tracker` component.
 */
export type TrackerData = {
  ok: number;
  count: number;
  date: Date;
  incidents: Incident[];
  statusReports: StatusReport[];
  status: Status;
  variant: StatusVariant;
};
