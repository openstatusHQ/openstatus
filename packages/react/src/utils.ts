import type { Status } from "./widget";

export const statusDictionary: Record<
  Status,
  { label: string; color: string }
> = {
  operational: {
    label: "Operational",
    color: "bg-green-500",
  },
  degraded_performance: {
    label: "Degraded Performance",
    color: "bg-yellow-500",
  },
  partial_outage: {
    label: "Partial Outage",
    color: "bg-yellow-500",
  },
  major_outage: {
    label: "Major Outage",
    color: "bg-red-500",
  },
  unknown: {
    label: "Unknown",
    color: "bg-gray-500",
  },
  incident: {
    label: "Incident",
    color: "bg-yellow-500",
  },
  under_maintenance: {
    label: "Under Maintenance",
    color: "bg-blue-500",
  },
} as const;
