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

/** "12 Oct, 22:00 - 13 Oct, 01:00 UTC"; same-day windows show time only. */
export function formatDateTimeRange(
  from: Date | string | number,
  to: Date | string | number,
): string {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${String(from)} - ${String(to)}`;
  }
  const s = parts(time, start);
  const e = parts(time, end);
  const sameDay = s("day") === e("day") && s("month") === e("month");
  const startLabel = `${s("day")} ${s("month")}, ${s("hour")}:${s("minute")}`;
  const endLabel = sameDay
    ? `${e("hour")}:${e("minute")}`
    : `${e("day")} ${e("month")}, ${e("hour")}:${e("minute")}`;
  return `${startLabel} - ${endLabel} UTC`;
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
