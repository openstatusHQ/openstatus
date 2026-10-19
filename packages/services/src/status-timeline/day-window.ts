import { TZDate } from "@date-fns/tz";

export const MS_PER_DAY = 86_400_000;

/** Half-open `[start, end)` in epoch ms. */
export type DayWindow = { start: number; end: number };

/**
 * The window of the calendar day a bar's `day` key names, in `timeZone`. Built
 * with TZDate directly: date-fns 3.6 helpers work in the machine's zone.
 */
export function dayWindow(day: string, timeZone = "UTC"): DayWindow {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  // UTC days are always 24h, so no zone lookup is needed
  if (timeZone === "UTC") {
    const start = Date.UTC(year, month - 1, date);
    return { start, end: start + MS_PER_DAY };
  }
  return {
    start: new TZDate(year, month - 1, date, timeZone).getTime(),
    end: new TZDate(year, month - 1, date + 1, timeZone).getTime(),
  };
}
