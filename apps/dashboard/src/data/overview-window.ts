export const OVERVIEW_WINDOW_DAYS = 7;

/**
 * Start of the window `/overview` renders: everything still open, plus what
 * closed in the last {@link OVERVIEW_WINDOW_DAYS} days.
 *
 * Truncated to the hour so the server prefetch and the client query hash to the
 * same tRPC query key — an exact `new Date()` on each side would differ by
 * milliseconds and miss the hydrated cache. Flooring widens the window, so the
 * result is always a superset of what the page filters down to.
 */
export function overviewActiveOrClosedSince(now = new Date()): Date {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return new Date(
    hour.getTime() - OVERVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
}
