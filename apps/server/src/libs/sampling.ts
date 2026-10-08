/** Wide-event sampling for the OTel sink; console logging is decided separately. */
export function shouldSample(event: Record<string, unknown>): boolean {
  const status = typeof event.status_code === "number" ? event.status_code : 0;

  // Always keep errors
  if (status >= 500) return true;
  if (event.error) return true;

  // Always keep shed and rate-limited requests so overload is visible at 100%
  if (event.shed || event.rate_limited) return true;
  if (status === 429 || status === 503) return true;

  // Always keep slow requests (above p99)
  if (typeof event.duration_ms === "number" && event.duration_ms > 2000) {
    return true;
  }

  // Random sample the rest at 20%
  return Math.random() < 0.2;
}
