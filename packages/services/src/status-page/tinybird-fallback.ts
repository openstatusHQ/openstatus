// Status pages must render even when Tinybird is degraded. Read latency above
// this budget is treated as an outage and the page falls back to manual mode.
export const TINYBIRD_FALLBACK_TIMEOUT_MS = 5_000;

// Discriminated result of a guarded Tinybird read: `ok: true` carries the data,
// `ok: false` (timeout or error) carries `null` and signals manual-mode fallback.
export type TinybirdResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: null };

// Races a Tinybird read against the fallback budget. `ok: false` (timeout or
// thrown error) signals the caller to serve manual mode — DB-authored events
// only — instead of hanging or 500ing on Tinybird.
export async function withTinybirdFallback<T>(
  fetch: () => Promise<T>,
  timeoutMs = TINYBIRD_FALLBACK_TIMEOUT_MS,
): Promise<TinybirdResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      fetch(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("tinybird timeout")),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true, data };
  } catch (err) {
    console.error("[status-page] tinybird unhealthy, using manual mode:", err);
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}
