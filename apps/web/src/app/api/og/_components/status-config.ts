import { Status } from "@openstatus/services/status-page";

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

export const statusDetails: Record<Status, StatusDetails> = {
  [Status.Operational]: {
    long: "All Systems Operational",
    short: "Operational",
    variant: "up",
  },
  [Status.DegradedPerformance]: {
    long: "Degraded Performance",
    short: "Degraded",
    variant: "degraded",
  },
  [Status.PartialOutage]: {
    long: "Partial Outage",
    short: "Outage",
    variant: "down",
  },
  [Status.MajorOutage]: {
    long: "Major Outage",
    short: "Outage",
    variant: "down",
  },
  [Status.UnderMaintenance]: {
    long: "Under Maintenance",
    short: "Maintenance",
    variant: "maintenance",
  },
  [Status.Unknown]: {
    long: "Unknown",
    short: "Unknown",
    variant: "empty",
  },
  [Status.Incident]: {
    long: "Downtime",
    short: "Downtime",
    variant: "incident",
  },
};

export const classNames: Record<StatusVariant, string> = {
  up: "bg-status-operational/90 data-[state=open]:bg-status-operational border-status-operational",
  degraded:
    "bg-status-degraded/90 data-[state=open]:bg-status-degraded border-status-degraded",
  down: "bg-status-down/90 data-[state=open]:bg-status-down border-status-down",
  empty: "bg-muted-foreground/20 data-[state=open]:bg-muted-foreground/30",
  incident:
    "bg-status-down/90 data-[state=open]:bg-status-down border-status-down",
  maintenance:
    "bg-status-monitoring/90 data-[state=open]:bg-status-monitoring border-status-monitoring",
};

/** Dates where OpenStatus itself failed to collect data. */
const blacklistDates: Record<string, string> = {
  "Fri Aug 25 2023":
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  "Sat Aug 26 2023":
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  "Wed Oct 18 2023":
    "OpenStatus migrated from Vercel to Fly to improve the performance of the checker.",
};

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

export function isInBlacklist(day: Date) {
  const el = Object.keys(blacklistDates).find((date) =>
    isSameDay(new Date(date), day),
  );
  return el ? blacklistDates[el] : undefined;
}
