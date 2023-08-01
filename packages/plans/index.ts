import type * as z from "zod";

import type { periodicityEnum } from "@openstatus/db/src/schema";

type Plan = {
  limits: {
    monitors: number;
    "status-pages": number;
    periodicity: Partial<z.infer<typeof periodicityEnum>>[];
  };
};

export const allPlans: Record<"free", Plan> = {
  free: {
    limits: {
      monitors: 0,
      "status-pages": 1,
      periodicity: ["10m", "30m", "1h"],
    },
  },
};
