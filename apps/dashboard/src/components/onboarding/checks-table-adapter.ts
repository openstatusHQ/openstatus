import type {
  CheckResult,
  CheckResultSuccess,
} from "@openstatus/services/monitor";

import type { OnboardingChecksRow } from "./checks-table";

function calculatePhases(timing: CheckResultSuccess["timing"]) {
  return {
    dns: timing.dnsDone - timing.dnsStart,
    connect: timing.connectDone - timing.connectStart,
    tls: timing.tlsHandshakeDone - timing.tlsHandshakeStart,
    ttfb: timing.firstByteDone - timing.firstByteStart,
    transfer: timing.transferDone - timing.transferStart,
  };
}

function sumPhases(phases: ReturnType<typeof calculatePhases>): number {
  return (
    phases.dns + phases.connect + phases.tls + phases.ttfb + phases.transfer
  );
}

/**
 * Adapt a Go-checker preview result into the `ResponseLog` shape
 * `getColumns` and `<Sheet>` expect. The synthesized row is "rich enough"
 * for both the table cells and the row-detail drawer.
 *
 * - `id` is set to `region` — synthetic but stable for selection.
 * - `requestStatus` derived from status + state.
 * - `timing` is the raw start/done timestamps that `<HoverCardTiming>`
 *   diffs into phases.
 */
export function checkResultToResponseLog(
  result: CheckResult,
  monitorId: number,
  monitorUrl: string,
): OnboardingChecksRow {
  const now = result.timestamp ?? Date.now();

  if (result.state === "error") {
    return {
      type: "http",
      id: result.region,
      latency: 0,
      statusCode: 0,
      requestStatus: "error",
      region: result.region,
      timing: null,
      timestamp: now,
      cronTimestamp: now,
      trigger: "api",
      monitorId: String(monitorId),
      url: monitorUrl,
      error: 1,
      message: result.message,
      headers: null,
      body: null,
      assertions: null,
      workspaceId: "",
    } as unknown as OnboardingChecksRow;
  }

  const requestStatus =
    result.status >= 400 ? "error" : result.status >= 200 ? "success" : "error";

  // The HoverCardTiming column renders each phase as `phase / latency *
  // 100%` of the bar width. If phase deltas don't sum to latency (idle
  // gaps between phases on the Go-checker side), the bar reads short
  // and the column looks broken. Use the phase sum as the denominator
  // so the bar always fills the cell.
  const phases = result.timing ? calculatePhases(result.timing) : null;
  const phaseLatency = phases ? sumPhases(phases) : 0;
  const latency = phaseLatency > 0 ? phaseLatency : result.latency;

  return {
    type: "http",
    id: result.region,
    latency,
    statusCode: result.status,
    requestStatus,
    region: result.region,
    timing: phases,
    timestamp: now,
    cronTimestamp: now,
    trigger: "api",
    monitorId: String(monitorId),
    url: monitorUrl,
    error: 0,
    message: null,
    headers: result.headers ?? null,
    body: result.body ?? null,
    assertions: null,
    workspaceId: "",
  } as unknown as OnboardingChecksRow;
}
