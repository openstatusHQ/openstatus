import type * as z from "zod";

import type { periodicityEnum } from "@openstatus/db/src/schema";

export type Plan = {
  limits: {
    monitors: number;
    "status-pages": number;
    periodicity: Partial<z.infer<typeof periodicityEnum>>[];
  };
};

export const allPlans: Record<"free" | "pro", Plan> = {
  free: {
    limits: {
      monitors: 5,
      "status-pages": 1,
      periodicity: ["10m", "30m", "1h"],
    },
  },
  pro: {
    limits: {
      monitors: 20,
      "status-pages": 5,
      periodicity: ["1m", "5m", "10m", "30m", "1h"],
    },
  },
};
