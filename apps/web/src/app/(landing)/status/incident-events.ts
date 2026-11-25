import type { StatusBarData } from "@openstatus/ui/components/blocks/status.types";

export type OverlayIncident = {
  id: string;
  name: string;
  impact?: string;
  shortlink?: string;
  startedAt?: string;
  createdAt: string;
  resolvedAt?: string | null;
};

type DayEvent = StatusBarData["events"][number];

function floorUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// Maps incidents onto the UTC days they overlap, keyed by `YYYY-MM-DD` so the
// keys line up with the day buckets built in the history bars. Each spanned day
// gets the incident's full range (`from`/`to`); `to: null` marks an ongoing one.
export function bucketIncidentsByUtcDay(
  incidents: OverlayIncident[],
  opts: { days: number; now?: Date },
): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>();
  const now = opts.now ?? new Date();
  const todayUtc = floorUtcDay(now);
  const windowStart = new Date(todayUtc);
  windowStart.setUTCDate(todayUtc.getUTCDate() - (opts.days - 1));

  for (const inc of incidents) {
    const startMs = Date.parse(inc.startedAt ?? inc.createdAt);
    if (Number.isNaN(startMs)) continue;

    // Only a null/absent resolvedAt is ongoing; a present-but-unparseable value
    // is bad data, so resolve it to a zero-length span (not extended to today).
    const from = new Date(startMs);
    let to: Date | null;
    let endMs: number;
    if (inc.resolvedAt == null) {
      to = null;
      endMs = now.getTime();
    } else {
      const resolvedMs = Date.parse(inc.resolvedAt);
      endMs = Number.isNaN(resolvedMs)
        ? startMs
        : Math.max(resolvedMs, startMs);
      to = new Date(endMs);
    }
    const type: DayEvent["type"] =
      inc.impact === "maintenance" ? "maintenance" : "incident";

    let cursor = floorUtcDay(new Date(startMs));
    if (cursor.getTime() < windowStart.getTime())
      cursor = floorUtcDay(windowStart);
    const lastDay = floorUtcDay(new Date(endMs));
    const lastClamped =
      lastDay.getTime() > todayUtc.getTime() ? todayUtc : lastDay;

    while (cursor.getTime() <= lastClamped.getTime()) {
      const iso = cursor.toISOString().slice(0, 10);
      const event: DayEvent = {
        id: inc.id,
        name: inc.name,
        type,
        from,
        to,
        shortlink: inc.shortlink,
      };
      const list = map.get(iso);
      if (list) list.push(event);
      else map.set(iso, [event]);
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return map;
}
