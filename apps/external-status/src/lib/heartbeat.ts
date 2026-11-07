import { getLogger } from "@logtape/logtape";

const logger = getLogger(["external-status"]);

const PING_TIMEOUT_MS = 5_000;

// OpenStatus heartbeat monitors take `<url>` for a success and `<url>/fail` for a failure.
export function heartbeatPingUrl(url: string, ok: boolean): string {
  const base = url.replace(/\/+$/, "");
  return ok ? base : `${base}/fail`;
}

// Never throws: a heartbeat outage must not fail the job it reports on.
// The URL embeds the monitor token, so it is never logged.
export async function pingHeartbeat(
  url: string,
  ok: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    const res = await fetchImpl(heartbeatPingUrl(url, ok), {
      method: "POST",
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn("heartbeat ping returned {status}", { status: res.status });
    }
  } catch (error) {
    logger.warn("heartbeat ping failed: {message}", {
      message: error instanceof Error ? error.name : String(error),
    });
  }
}
