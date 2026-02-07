export type StatusType = "success" | "degraded" | "error" | "info" | "empty";
export type StatusEventType = "incident" | "report" | "maintenance";
export type StatusReportUpdateType = "investigating" | "identified" | "monitoring" | "resolved"

export interface StatusReportUpdate {
  date: Date;
  message: string;
  status: StatusReportUpdateType;
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
    }[];
    events: {
        id: number;
        name: string;
        type: StatusEventType;
        from: Date | null;
        to: Date | null;
    }[];
}