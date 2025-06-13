import type { ChartConfig } from "@/components/ui/chart";

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
} satisfies ChartConfig;
