export type RegionMetric = {
  region: string;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  /** Buckets with data in the period; 0 means the region never reported. */
  buckets: number;
};
