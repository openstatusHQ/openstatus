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

/**
 * Adapt a Go-checker preview result into the `ResponseLog` shape
 * `getColumns` and `<Sheet>` expect. The synthesized row is "rich enough"
 * for both the table cells and the row-detail drawer.
 *
 * - `id` is set to `region` — synthetic but stable for selection.
 * - `requestStatus` derived from status + state.
 * - `timing` is the raw start/done timestamps that `<HoverCardTiming>`
 *   diffs into phases.
 * - `workspaceId` is intentionally `""` — no current row renderer
 *   (`columns.tsx`, `data-table-basics.tsx`, `data-table-sheet.tsx`)
 *   reads it. If a future renderer constructs a URL from `workspaceId`,
 *   plumb the real id through here.
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
      error: true,
      message: result.message,
      headers: null,
      body: null,
      assertions: null,
      workspaceId: "",
    } satisfies OnboardingChecksRow;
  }

  const requestStatus =
    result.status >= 400 ? "error" : result.status >= 200 ? "success" : "error";

  const phases = result.timing ? calculatePhases(result.timing) : null;

  return {
    type: "http",
    id: result.region,
    latency: result.latency,
    statusCode: result.status,
    requestStatus,
    region: result.region,
    timing: phases,
    timestamp: now,
    cronTimestamp: now,
    trigger: "api",
    monitorId: String(monitorId),
    url: monitorUrl,
    error: false,
    message: null,
    headers: result.headers ?? null,
    body: result.body ?? null,
    assertions: null,
    workspaceId: "",
  } satisfies OnboardingChecksRow;
}
