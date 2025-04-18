export const statusDict = {
  investigating: {
    value: "investigating",
    label: "Investigating",
    icon: "search",
    color: "border-status-down/20 bg-status-down/10 text-status-down",
    order: 1,
  },
  identified: {
    value: "identified",
    label: "Identified",
    icon: "fingerprint",
    color:
      "border-status-degraded/20 bg-status-degraded/10 text-status-degraded",
    order: 2,
  },
  monitoring: {
    value: "monitoring",
    label: "Monitoring",
    icon: "activity",
    color:
      "border-status-monitoring/20 bg-status-monitoring/10 text-status-monitoring",
    order: 3,
  },
  resolved: {
    value: "resolved",
    label: "Resolved",
    icon: "search-check",
    color:
      "border-status-operational/20 bg-status-operational/10 text-status-operational",
    order: 4,
  },
  // FIXME: check source of thruth
  maintenance: {
    value: "maintenance",
    label: "Maintenance",
    icon: "hammer",
    color:
      "border-status-monitoring/20 bg-status-monitoring/10 text-status-monitoring",
    order: 0,
  },
} as const;

// TODO: check if we can use the status-color palette
export const severityDict = {
  critical: {
    value: "critical",
    label: "Critical",
    level: 1,
    color: "bg-red-50 hover:bg-red-50 border-red-100 text-red-500",
  },
  high: {
    value: "high",
    label: "High",
    level: 2,
    color: "bg-orange-50 hover:bg-orange-50 border-orange-100 text-orange-500",
  },
  moderate: {
    value: "moderate",
    label: "Moderate",
    level: 3,
    color: "bg-amber-50 hover:bg-amber-50 border-amber-100 text-amber-500",
  },
  low: {
    value: "low",
    label: "Low",
    level: 4,
    color: "bg-yellow-50 hover:bg-yellow-50 border-yellow-100 text-yellow-500",
  },
  informational: {
    value: "informational",
    label: "Informational",
    level: 5,
    color: "bg-blue-50 hover:bg-blue-50 border-blue-100 text-blue-500",
  },
} as const;
