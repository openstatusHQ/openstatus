type Plan = {
  limits: {
    monitors: number;
    "status-pages": number;
    "cron-jobs": Partial<"1m" | "5m" | "10m" | "30m" | "1h" | "other">[];
  };
};

export const plansConfig: Record<"free", Plan> = {
  free: {
    limits: {
      monitors: 5,
      "status-pages": 1,
      "cron-jobs": ["10m"],
    },
  },
};
