const randomizer = Math.random() * 10;

export const regionPercentile = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(
    new Date().setMinutes(new Date().getMinutes() - i),
  ).toLocaleString("default", {
    hour: "numeric",
    minute: "numeric",
  }),
  latency: Math.floor(Math.random() * randomizer + 1) * 100,
})).map((item, i) => {
  const baseLatency = item.latency;
  const randomFactor = () => 0.85 + Math.random() * 0.3; // Random factor between 0.85-1.15

  return {
    ...item,
    // More realistic percentile distribution with randomness
    p50: Math.round(baseLatency * 0.7 * randomFactor()),
    p75: Math.round(baseLatency * 0.85 * randomFactor()),
    p90: Math.round(baseLatency * 1.1 * randomFactor()),
    p95: Math.round(baseLatency * 1.3 * randomFactor()),
    p99: Math.round(baseLatency * 1.8 * randomFactor()),
    // REMINDER: for error bars
    error: [4, 5, 6].includes(i) ? 1 : undefined,
  };
});

export type RegionPercentile = (typeof regionPercentile)[number];
