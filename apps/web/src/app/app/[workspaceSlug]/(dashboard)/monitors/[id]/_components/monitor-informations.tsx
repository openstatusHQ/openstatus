import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

import { MetricsCard } from "./metrics-card";

export function MonitorInformations({
  periodicity,
}: {
  periodicity: MonitorPeriodicity;
}) {
  return <div className="flex flex-wrap gap-4 md:gap-6" />;
}

const _periodicityDict = {
  "30s": {
    value: 30,
    unit: "seconds",
  },
  "1m": {
    value: 1,
    unit: "minute",
  },
  "5m": {
    value: 5,
    unit: "minutes",
  },
  "10m": {
    value: 10,
    unit: "minutes",
  },
  "30m": {
    value: 30,
    unit: "minutes",
  },
  "1h": {
    value: 1,
    unit: "hour",
  },
  other: {
    value: 0,
    unit: "",
  },
} satisfies Record<MonitorPeriodicity, { value: number; unit: string }>;
