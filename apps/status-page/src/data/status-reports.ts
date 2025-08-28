const today = new Date();
const lastHour = new Date(new Date().setHours(new Date().getHours() - 1));
const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));

console.log({ today, lastHour, yesterday });

export const statusReports = [
  {
    id: 1,
    name: "Downtime API due to hosting provider with 400 errors",
    startedAt: yesterday,
    updatedAt: today,
    status: "operational",
    updates: [
      {
        id: 2,
        status: "operational" as const,
        message:
          "Everything is under control, we continue to monitor the situation.",
        date: today,
        updatedAt: today,
        monitors: [1],
      },
      {
        id: 1,
        status: "investigating" as const,
        message:
          "Our hosting provider is having an increase of 400 errors. We are aware of the dependency and will be working on a solution to reduce the risk.",
        date: lastHour,
        updatedAt: lastHour,
        monitors: [1],
      },
    ],
    affected: ["OpenStatus API"],
  },
  {
    id: 3,
    name: "Downtime API due to hosting provider with 400 errors",
    startedAt: new Date("2025-08-05 12:10:00"),
    updatedAt: new Date("2025-08-05 12:30:00"),
    status: "operational",
    updates: [
      {
        id: 4,
        status: "operational" as const,
        message:
          "Everything is under control, we continue to monitor the situation.",
        date: new Date("2025-08-06 03:30:00"),
        updatedAt: new Date("2025-08-06 03:30:00"),
        monitors: [1],
      },
      {
        id: 3,
        status: "monitoring" as const,
        message:
          "We are continuing to monitor the situation to ensure that the issue is resolved.",
        date: new Date("2025-08-05 16:00:00"),
        updatedAt: new Date("2025-08-05 16:00:00"),
        monitors: [1],
      },
      {
        id: 2,
        status: "identified" as const,
        message:
          "We have identified the root cause of the issue. It is due to a configuration error on our part.",
        date: new Date("2025-08-05 14:00:00"),
        updatedAt: new Date("2025-08-05 14:00:00"),
        monitors: [1],
      },
      {
        id: 1,
        status: "investigating" as const,
        message:
          "Our hosting provider is having an increase of 400 errors. We are working on a solution to reduce the risk.",
        date: new Date("2025-08-05 12:00:00"),
        updatedAt: new Date("2025-08-05 12:00:00"),
        monitors: [1],
      },
    ],
    affected: ["OpenStatus API"],
  },
];

export type StatusReport = (typeof statusReports)[number];
