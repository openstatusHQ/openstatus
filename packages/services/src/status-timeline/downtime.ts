export type WeightedInterval = { from: number; to: number; weight: number };

// concurrent events describing the same outage must not double-count
// downtime: per time slice the worst (max) weight wins, mirroring
// mergeWorstImpactIntervals — summing could push uptime negative
export function mergedDowntimeMs(intervals: WeightedInterval[]): number {
  const boundaries = [
    ...new Set(intervals.flatMap((iv) => [iv.from, iv.to])),
  ].sort((a, b) => a - b);

  let total = 0;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const sliceStart = boundaries[i];
    const sliceEnd = boundaries[i + 1];
    let weight = 0;
    for (const iv of intervals) {
      if (iv.from <= sliceStart && iv.to >= sliceEnd) {
        weight = Math.max(weight, iv.weight);
      }
    }
    total += weight * (sliceEnd - sliceStart);
  }
  return total;
}
