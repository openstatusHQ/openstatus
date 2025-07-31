import type { Region } from "./regions";

export const regionMetrics = [
  {
    region: "ams" as const satisfies Region,
    p50: 100,
    p90: 150,
    p99: 200,
    trend: [{ ams: 100, timestamp: 1716729600, latency: 100 }] as {
      [key: string]: number;
      timestamp: number;
      latency: number;
    }[],
  },
  {
    region: "fra" as const satisfies Region,
    p50: 110,
    p90: 155,
    p99: 220,
    trend: [{ fra: 100, timestamp: 1716729600, latency: 100 }] as {
      [key: string]: number;
      timestamp: number;
      latency: number;
    }[],
  },
  {
    region: "gru" as const satisfies Region,
    p50: 120,
    p90: 160,
    p99: 230,
    trend: [{ gru: 100, timestamp: 1716729600, latency: 100 }] as {
      [key: string]: number;
      timestamp: number;
      latency: number;
    }[],
  },
];

export type RegionMetric = (typeof regionMetrics)[number];
