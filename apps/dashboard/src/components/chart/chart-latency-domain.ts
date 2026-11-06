/**
 * Calculates the Y-axis upper domain for latency charts.
 *
 * Shows the degraded threshold line unless it would squash the series below half height.
 * Clamps with Math.max(dataMax, degradedAfter) to avoid clipping latency spikes that exceed degradedAfter.
 */
export function computeLatencyYAxisDomain(
  dataMax: number,
  degradedAfter?: number | null,
): number {
  return degradedAfter && degradedAfter <= dataMax * 2
    ? Math.max(dataMax, degradedAfter)
    : dataMax;
}
