import type { StatusDetails, StatusVariant } from "./types";
import { Status } from "./types";

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

// TODO: include more variants especially for the '< 10 min' incidents e.g.
// REMINDER: add `@openstatus/tracker/src/**/*.ts into tailwindcss content prop */
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
