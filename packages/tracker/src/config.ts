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
    short: "Partial",
    variant: "down",
  },
  [Status.MajorOutage]: {
    long: "Major Outage",
    short: "Major",
    variant: "down",
  },
  [Status.UnderMaintenance]: {
    long: "Under Maintenance",
    short: "Maintenance",
    variant: "empty",
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

// REMINDER: add `@openstatus/tracker/src/**/*.ts into tailwindcss content prop */
export const classNames: Record<StatusVariant, string> = {
  up: "bg-green-500/90 data-[state=open]:bg-green-500 border-green-500",
  degraded: "bg-amber-500/90 data-[state=open]:bg-amber-500 border-amber-500",
  down: "bg-red-500/90 data-[state=open]:bg-red-500 border-red-500",
  empty: "bg-gray-500/90 data-[state=open]:bg-gray-500 border-gray-500",
  incident: "bg-red-500/90 data-[state=open]:bg-red-500 border-red-500",
};
