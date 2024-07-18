export const statusDict = {
  investigating: {
    value: "investigating",
    label: "Investigating",
    icon: "search",
    color: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    order: 1,
  },
  identified: {
    value: "identified",
    label: "Identified",
    icon: "fingerprint",
    color: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    order: 2,
  },
  monitoring: {
    value: "monitoring",
    label: "Monitoring",
    icon: "activity",
    color: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    order: 3,
  },
  resolved: {
    value: "resolved",
    label: "Resolved",
    icon: "search-check",
    color: "border-green-500/20 bg-green-500/10 text-green-500",
    order: 4,
  },
  // FIXME: check source of thruth
  maintenance: {
    value: "maintenance",
    label: "Maintenance",
    icon: "hammer",
    color: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    order: 0,
  },
} as const;
