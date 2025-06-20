export const incidents = [
  {
    id: 1,
    startedAt: new Date("2025-05-05 12:00:00"),
    acknowledged: null,
    resolvedAt: new Date("2025-05-05 14:00:00"),
    monitor: "OpenStatus API",
  },
];

export type Incident = (typeof incidents)[number];
