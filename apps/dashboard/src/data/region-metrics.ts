import { Region } from "./regions";

export const regionMetrics = [
  {
    region: "ams" as const satisfies Region,
    p50: 100,
    p90: 150,
    p99: 200,
    trend: [{ latency: 100, timestamp: 1716729600 }],
  },
  {
    region: "fra" as const satisfies Region,
    p50: 110,
    p90: 155,
    p99: 220,
    trend: [{ latency: 100, timestamp: 1716729600 }],
  },
  {
    region: "gru" as const satisfies Region,
    p50: 120,
    p90: 160,
    p99: 230,
    trend: [{ latency: 100, timestamp: 1716729600 }],
  },
];

export type RegionMetric = (typeof regionMetrics)[number];
