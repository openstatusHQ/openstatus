export const statusDict = {
  investigating: {
    value: "investigating",
    label: "Investigating",
    icon: "search",
    order: 1,
  },
  identified: {
    value: "identified",
    label: "Identified",
    icon: "fingerprint",
    order: 2,
  },
  monitoring: {
    value: "monitoring",
    label: "Monitoring",
    icon: "activity",
    order: 3,
  },
  resolved: {
    value: "resolved",
    label: "Resolved",
    icon: "search-check",
    order: 4,
  },
} as const;
