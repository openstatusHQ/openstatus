export type StatusType = "success" | "degraded" | "error" | "info" | "empty";
export type StatusEventType = "incident" | "report" | "maintenance";
export type StatusReportUpdateType =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

// mirrors openstatus's `pageComponentImpact` taxonomy (this package doesn't depend on the db)
export type StatusReportImpact =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage";

export const THEME_VALUES = ["light", "dark", "system"] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export interface StatusReportUpdate {
  date: Date;
  message: string;
  status: StatusReportUpdateType;
  /** Per-component impact changes this update set. */
  impactChanges?: { name: string; impact: StatusReportImpact }[];
}

export interface StatusReport {
  id: number;
  title: string;
  affected: string[];
  updates: StatusReportUpdate[];
}

export interface Maintenance {
  id: number;
  title: string;
  affected: string[];
  message: string;
  from: Date;
  to: Date;
}

// Discriminated union for status events
export type StatusEventData =
  | { type: "report"; data: StatusReport }
  | { type: "maintenance"; data: Maintenance };

export type StatusBarData = {
  day: string;
  bar: {
    status: StatusType;
    // NOTE: is in percentage! should sum up to 100%
    height: number;
  }[];
  card: {
    status: StatusType;
    value: string;
    /** Worst report impact of the day — refines the generic status label. */
    impact?: StatusReportImpact;
  }[];
  events: {
    id: number | string;
    name: string;
    type: StatusEventType;
    from: Date | null;
    to: Date | null;
    isAggregated?: boolean;
    /** Overrides the type-derived dot color (e.g. the day's worst report impact). */
    status?: Exclude<StatusType, "empty">;
    /** External link for the event (e.g. an upstream incident page). */
    shortlink?: string;
  }[];
};
