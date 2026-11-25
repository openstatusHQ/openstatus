import type {
  BadRange,
  FrozenMonitorUptimeDay,
  InsertFrozenMonitorUptime,
} from "../schema";

type Failure = { day: number; ranges: BadRange[] };

export function monthStart(offset: number, now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
}

// One check per minute from one cloud region, so requests and runs match.
function frozenMonth(
  start: Date,
  failures: Failure[],
  withRanges: boolean,
): FrozenMonitorUptimeDay[] {
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = new Date(start.getTime() + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const ranges =
      failures.find((f) => f.day === i + 1 || f.day === i - daysInMonth)
        ?.ranges ?? [];
    let degraded = 0;
    let error = 0;
    for (const [, n, d, e] of ranges) {
      degraded += n * d;
      error += n * e;
    }
    const counts = { ok: 1440 - degraded - error, degraded, error };
    return {
      day,
      requests: counts,
      runs: counts,
      ...(withRanges && ranges.length
        ? { bad: { requests: ranges, runs: ranges } }
        : {}),
    };
  });
}

/**
 * Last full month carries bucket ranges; the month before is a legacy row
 * (no ranges) so History shows it as UTC-only.
 */
export function frozenUptimeSeed(): InsertFrozenMonitorUptime[] {
  const last = monthStart(-1);
  const before = monthStart(-2);
  const month = (d: Date) => d.toISOString().slice(0, 10);

  // day -1 = last day of the month: 23:30–23:50 UTC lands in the next month
  // for zones east of UTC
  const apiFailures: Failure[] = [
    { day: 5, ranges: [[40, 1, 3, 0]] },
    {
      day: 12,
      ranges: [
        [8, 1, 0, 5],
        [9, 1, 0, 15],
        [10, 1, 0, 10],
      ],
    },
    {
      day: -1,
      ranges: [
        [94, 1, 0, 15],
        [95, 1, 0, 5],
      ],
    },
  ];
  const websiteFailures: Failure[] = [{ day: 20, ranges: [[56, 4, 0, 15]] }];

  return [
    {
      workspaceId: 1,
      monitorId: 1,
      month: month(last),
      days: frozenMonth(last, apiFailures, true),
    },
    {
      workspaceId: 1,
      monitorId: 3,
      month: month(last),
      days: frozenMonth(last, websiteFailures, true),
    },
    {
      workspaceId: 1,
      monitorId: 1,
      month: month(before),
      days: frozenMonth(before, [{ day: 18, ranges: [[60, 2, 0, 15]] }], false),
    },
    {
      workspaceId: 1,
      monitorId: 3,
      month: month(before),
      days: frozenMonth(before, [], false),
    },
  ];
}
