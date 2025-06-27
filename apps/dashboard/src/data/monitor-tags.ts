export const monitorTags = [
  {
    value: "production",
    label: "Production",
    color: "bg-green-500",
  },
  {
    value: "development",
    label: "Development",
    color: "bg-blue-500",
  },
  {
    value: "staging",
    label: "Staging",
    color: "bg-yellow-500",
  },
  {
    value: "testing",
    label: "Testing",
    color: "bg-purple-500",
  },
  {
    value: "api",
    label: "API",
    color: "bg-red-500",
  },
  {
    value: "database",
    label: "Database",
    color: "bg-orange-500",
  },
];

export type MonitorTag = (typeof monitorTags)[number];
