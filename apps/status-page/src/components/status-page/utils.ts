import type { ChartConfig } from "@/components/ui/chart";
import { VARIANT } from "./floating-button";

export const chartData = Array.from({ length: 45 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - i);

  // Simulate realistic daily status distribution that sums to 1440 minutes
  let error = 0;
  let degraded = 0;
  let success = 1440; // Start with all minutes as ok
  let info = 0;

  // Simulate some incidents on certain days
  if (i === 3) {
    // Day 3: Major incident for 2 hours (120 minutes)
    error = 120;
    success -= error;
  } else if (i === 16) {
    // Day 16: Degraded performance for 4 hours (240 minutes)
    degraded = 240;
    success -= degraded;
  } else if (i === 8) {
    // Day 8: Brief outage (30 minutes) + some degraded performance (60 minutes)
    error = 30;
    degraded = 60;
    success -= error + degraded;
  } else if (i === 13) {
    info = 120;
    success -= info;
  } else if (i === 22) {
    // Day 22: Extended degraded performance (6 hours = 360 minutes)
    degraded = 360;
    success -= degraded;
  } else if (Math.random() > 0.85) {
    // Random minor issues on some days (5-15 minutes of degraded performance)
    degraded = Math.floor(Math.random() * 10) + 5;
    success -= degraded;
  }

  return {
    timestamp: date.getTime(),
    info,
    degraded,
    error,
    success,
  };
}).reverse();

export type ChartData = (typeof chartData)[number];

export const chartConfig = {
  success: {
    label: "success",
    color: "var(--success)",
  },
  degraded: {
    label: "degraded",
    color: "var(--warning)",
  },
  error: {
    label: "error",
    color: "var(--destructive)",
  },
  info: {
    label: "info",
    color: "var(--info)",
  },
  empty: {
    label: "empty",
    color: "var(--muted)",
  },
} satisfies ChartConfig;

export const PRIORITY = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
} as const; // satisfies Record<XXX, number>;

export function getHighestPriorityStatus(item: ChartData) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) return "empty";
  return (
    VARIANT.filter((status) => item[status] > 0).sort(
      (a, b) => PRIORITY[b] - PRIORITY[a],
    )[0] || "empty"
  );
}

export const PERCENTAGE_PRIORITY = {
  info: -1,
  error: 0,
  degraded: 0.75,
  success: 0.95,
} as const;

export function getPercentagePriorityStatus(item: ChartData) {
  const total = item.success + item.degraded + item.info + item.error;
  if (total === 0) return "empty";

  const percentage = item.success / total;
  if (percentage >= PERCENTAGE_PRIORITY.success) return "success";
  if (percentage >= PERCENTAGE_PRIORITY.degraded) return "degraded";
  if (percentage >= PERCENTAGE_PRIORITY.error) return "error";
  if (percentage >= PERCENTAGE_PRIORITY.info) return "info";
  return "info";
}

export function getTotalUptime(item: ChartData[]) {
  const { ok, total } = item.reduce(
    (acc, item) => ({
      ok: acc.ok + item.success + item.degraded + item.info,
      total: acc.total + item.success + item.degraded + item.info + item.error,
    }),
    {
      ok: 0,
      total: 0,
    },
  );

  if (total === 0) return 100;
  return Math.round((ok / total) * 10000) / 100;
}

export function getTotalTime(
  items: { from: Date | null; to: Date | null }[],
  days: number,
) {
  const duration = items.reduce((acc, item) => {
    if (!item.from) return acc;
    return acc + ((item.to || new Date()).getTime() - item.from.getTime());
  }, 0);

  const total = days * 24 * 60 * 60 * 1000;

  return Math.round(((total - duration) / total) * 10000) / 100;
}
