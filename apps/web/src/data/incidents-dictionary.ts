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
