export type LatencyRegionSeries = {
  region: string;
  /** Milliseconds per bucket, aligned with the chart's timestamps; null is a gap. */
  values: (number | null)[];
};

export type LatencyRegionRow = { timestamp: number } & Record<
  string,
  number | null
>;

/** One row per bucket, each series under `s<index>`. */
export function toLatencyRegionRows(
  timestamps: number[],
  series: LatencyRegionSeries[],
): LatencyRegionRow[] {
  return timestamps.map((timestamp, bucket) => {
    const row: LatencyRegionRow = { timestamp };
    series.forEach((s, i) => {
      row[`s${i}`] = s.values[bucket] ?? null;
    });
    return row;
  });
}
