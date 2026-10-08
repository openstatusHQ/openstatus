// en-US for "Sep" — en-GB abbreviates September as "Sept".
const time = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const day = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parts(format: Intl.DateTimeFormat, date: Date) {
  const map = new Map(format.formatToParts(date).map((p) => [p.type, p.value]));
  return (type: Intl.DateTimeFormatPartTypes) => map.get(type) ?? "";
}

/** "18 Sep, 12:37 UTC" — no per-user timezone exists, so always UTC. */
export function formatDateTime(input: Date | string | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const p = parts(time, date);
  return `${p("day")} ${p("month")}, ${p("hour")}:${p("minute")} UTC`;
}

/** "Fri 25 Sep 2026" — day-only dates carry no timezone suffix. */
export function formatDay(input: Date | string | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const p = parts(day, date);
  return `${p("weekday")} ${p("day")} ${p("month")} ${p("year")}`;
}

/** "Friday 25 September" — for titles. */
export function formatLongDay(input: Date | string | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const p = parts(longDay, date);
  return `${p("weekday")} ${p("day")} ${p("month")}`;
}

/** "25 Sep" — for subjects. */
export function formatShortDay(input: Date | string | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const p = parts(time, date);
  return `${p("day")} ${p("month")}`;
}

/** "2h 14m" between two instants; minutes only under an hour. */
export function formatElapsed(from: Date | string, to: Date | string): string {
  const minutes = Math.max(
    0,
    Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60_000),
  );
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
