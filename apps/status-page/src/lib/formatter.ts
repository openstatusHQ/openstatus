import { TZDate } from "@date-fns/tz";

export function formatMilliseconds(ms: number) {
  if (ms > 1000) {
    return `${Intl.NumberFormat("en-US", {
      style: "unit",
      unit: "second",
      maximumFractionDigits: 2,
    }).format(ms / 1000)}`;
  }

  return `${Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "millisecond",
    maximumFractionDigits: 0,
  }).format(ms)}`;
}

export function formatMillisecondsRange(min: number, max: number) {
  // Both above 1000ms: share the seconds unit, so only `max` carries it.
  if (min > 1000 && max > 1000) {
    return `${formatNumber(min / 1000, { maximumFractionDigits: 2 })} - ${formatMilliseconds(max)}`;
  }

  // Both below 1000ms: share the milliseconds unit, so only `max` carries it.
  if (min < 1000 && max < 1000) {
    return `${formatNumber(min)} - ${formatMilliseconds(max)}`;
  }

  // Mixed: format each endpoint with its own unit.
  return `${formatMilliseconds(min)} - ${formatMilliseconds(max)}`;
}

export function formatPercentage(value: number, fractionDigits = 3) {
  if (Number.isNaN(value)) return "100%";
  return `${Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}`;
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return `${Intl.NumberFormat("en-US", options).format(value)}`;
}

// TODO: think of supporting custom formats

// All status-page timestamps render in the page's zone (UTC unless the page
// says otherwise) so every viewer sees the same time; the StatusTimestamp hover
// card surfaces the viewer's local timezone on demand.

// Day boundaries are built with TZDate directly: date-fns 3.6 helpers work in
// the machine's zone.
function dayStartMs(date: Date, timeZone: string, dayOffset = 0): number {
  const d = new TZDate(date, timeZone);
  return new TZDate(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + dayOffset,
    timeZone,
  ).getTime();
}

function isStartOfDay(date: Date, timeZone: string) {
  return dayStartMs(date, timeZone) === date.getTime();
}

function isEndOfDay(date: Date, timeZone: string) {
  return dayStartMs(date, timeZone, 1) - 1 === date.getTime();
}

function isSameDay(a: Date, b: Date, timeZone: string) {
  return dayStartMs(a, timeZone) === dayStartMs(b, timeZone);
}

export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions & { locale?: string },
) {
  const { locale, timeZone = "UTC", ...rest } = options ?? {};
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...rest,
    timeZone,
  });
}

export function formatDateTime(date: Date, locale?: string, timeZone = "UTC") {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone,
  });
}

export function formatTime(date: Date, locale?: string, timeZone = "UTC") {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "numeric",
    timeZone,
  });
}

/** Compact banner stamp, `Oct 03, 2026 14:41`, in `timeZone`. */
export function formatTimestamp(date: Date, timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("month")} ${part("day")}, ${part("year")} ${part("hour")}:${part("minute")}`;
}

/**
 * Returns the start/end of a closed range as separate strings, collapsing the
 * `to` side to a time-only render when `from` and `to` fall on the same day.
 * Use `formatDateRange` for open-ended cases (`Until …` / `Since …`).
 */
export function formatDateRangeParts(
  from: Date,
  to: Date,
  locale?: string,
  timeZone = "UTC",
): { from: string; to: string } {
  if (isSameDay(from, to, timeZone)) {
    return {
      from: formatDateTime(from, locale, timeZone),
      to: formatTime(to, locale, timeZone),
    };
  }
  if (isStartOfDay(from, timeZone) && isEndOfDay(to, timeZone)) {
    return {
      from: formatDate(from, { locale, timeZone }),
      to: formatDate(to, { locale, timeZone }),
    };
  }
  return {
    from: formatDateTime(from, locale, timeZone),
    to: formatDateTime(to, locale, timeZone),
  };
}

export function formatDateRange(
  from?: Date,
  to?: Date,
  locale?: string,
  timeZone = "UTC",
) {
  if (from && to) {
    if (from.getTime() === to.getTime()) {
      return formatDateTime(from, locale, timeZone);
    }
    if (isSameDay(from, to, timeZone)) {
      return `${formatDateTime(from, locale, timeZone)} - ${formatTime(to, locale, timeZone)}`;
    }
    if (isStartOfDay(from, timeZone) && isEndOfDay(to, timeZone)) {
      return `${formatDate(from, { locale, timeZone })} - ${formatDate(to, { locale, timeZone })}`;
    }
    return `${formatDateTime(from, locale, timeZone)} - ${formatDateTime(to, locale, timeZone)}`;
  }

  if (to) {
    return `Until ${formatDateTime(to, locale, timeZone)}`;
  }

  if (from) {
    return `Since ${formatDateTime(from, locale, timeZone)}`;
  }

  return "All time";
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
