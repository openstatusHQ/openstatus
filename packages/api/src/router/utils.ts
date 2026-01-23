/**
 * Shared utilities for API routers
 */

/**
 * Supported time period values for filtering data
 */
export const periods = ["1d", "7d", "14d"] as const;

/**
 * Period type for filtering data by time range
 */
export type Period = (typeof periods)[number];

/**
 * Converts a period string to a Date object representing the start of that period
 * @param period - The period to convert (e.g., "1d", "7d", "14d")
 * @returns Date object representing the start of the period (for use with gte filters)
 * @example
 * // Get date for 7 days ago
 * const date = getPeriodDate("7d");
 * // Returns: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
 */
export function getPeriodDate(period: Period): Date {
  const now = Date.now();

  switch (period) {
    case "1d":
      return new Date(now - 1 * 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "14d":
      return new Date(now - 14 * 24 * 60 * 60 * 1000);
    default:
      // TypeScript ensures this is exhaustive, but return 7d as safe fallback
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }
}
