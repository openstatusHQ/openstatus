import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

export type Plan = {
  limits: {
    monitors: number;
    "status-pages": number;
    periodicity: Partial<MonitorPeriodicity>[];
    members: number;
  };
};

export const allPlans: Record<"free" | "pro", Plan> = {
  free: {
    limits: {
      monitors: 5,
      "status-pages": 1,
      periodicity: ["10m", "30m", "1h"],
      members: 1,
    },
  },
  pro: {
    limits: {
      monitors: 20,
      "status-pages": 5,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
      members: 5,
    },
  },
};
