import type { StatusVariant } from "./types";
import { Status } from "./types";

export const statusDict: Record<Status, string> = {
  [Status.Operational]: "Operational",
  [Status.DegradedPerformance]: "Degraded Performance",
  [Status.PartialOutage]: "Partial Outage",
  [Status.MajorOutage]: "Major Outage",
  [Status.UnderMaintenance]: "Under Maintenance",
  [Status.Unknown]: "Unknown",
  [Status.Incident]: "Downtime",
};

// SOMETIMES YOU WISH A BIT MORE TEXT
export const statusLongDict: Record<Status, string> = {
  [Status.Operational]: "All Systems Operational",
  [Status.DegradedPerformance]: "Degraded Performance",
  [Status.PartialOutage]: "Partial Outage",
  [Status.MajorOutage]: "Major Outage",
  [Status.UnderMaintenance]: "Under Maintenance",
  [Status.Unknown]: "Unknown",
  [Status.Incident]: "Downtime",
};

export const variants: Record<Status, StatusVariant> = {
  [Status.Operational]: "up",
  [Status.DegradedPerformance]: "degraded",
  [Status.PartialOutage]: "down",
  [Status.MajorOutage]: "down",
  [Status.UnderMaintenance]: "down",
  [Status.Unknown]: "empty",
  [Status.Incident]: "incident",
};

// REMINDER: add `@openstatus/tracker/src/**/*.ts into tailwindcss content prop */
export const classNames: Record<StatusVariant, string> = {
  up: "bg-green-500/90 data-[state=open]:bg-green-500 border-green-500",
  degraded: "bg-amber-500/90 data-[state=open]:bg-amber-500 border-amber-500",
  down: "bg-red-500/90 data-[state=open]:bg-red-500 border-red-500",
  empty: "bg-gray-500/90 data-[state=open]:bg-gray-500 border-gray-500",
  incident: "bg-red-500/90 data-[state=open]:bg-red-500 border-red-500",
};
