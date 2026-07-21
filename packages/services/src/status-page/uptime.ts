import {
  type Event,
  type StatusData,
  type UptimeWindow,
  dayCoverage,
  durationDowntimeMs,
  floorPct,
  reportsOnlyDowntimeMs,
  requestsTally,
} from "../status-timeline";

export function getUptime({
  data,
  events,
  barType,
  cardType,
}: {
  data: StatusData[];
  events: Event[];
  barType: "absolute" | "dominant" | "manual";
  cardType: "requests" | "duration" | "dominant" | "manual";
}): string {
  if (barType === "manual" || cardType === "duration") {
    // Clamp event durations to the data lookback window to avoid
    // events outside the window producing negative uptime values.
    const timestamps = data.map((d) => new Date(d.day).getTime());
    const { segments: coverage, totalMs: total } = dayCoverage(timestamps);
    if (total === 0) return "100%";
    const windowEndDate = new Date(Math.max(...timestamps));
    windowEndDate.setUTCHours(23, 59, 59, 999);
    const window: UptimeWindow = {
      start: Math.min(...timestamps),
      end: windowEndDate.getTime(),
      now: Date.now(),
    };
    const duration =
      barType === "manual"
        ? reportsOnlyDowntimeMs(events, window, coverage)
        : durationDowntimeMs(events, window, coverage);
    return `${floorPct((total - duration) / total)}%`;
  }

  const { up, total } = requestsTally(data);
  if (total === 0) return "100%";
  return `${floorPct(up / total)}%`;
}
