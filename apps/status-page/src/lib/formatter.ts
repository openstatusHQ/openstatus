import { endOfDay, isSameDay, startOfDay } from "date-fns";

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
  }).format(ms)}`;
}

export function formatMillisecondsRange(min: number, max: number) {
  if ((min > 1000 && max > 1000) || (min < 1000 && max < 1000)) {
    return `${formatNumber(min / 1000)} - ${formatMilliseconds(max)}`;
  }

  return `${formatMilliseconds(min)} - ${formatMilliseconds(max)}`;
}

export function formatPercentage(value: number) {
  if (Number.isNaN(value)) return "100%";
  return `${Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return `${Intl.NumberFormat("en-US", options).format(value)}`;
}

// TODO: think of supporting custom formats

export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions & { locale?: string },
) {
  const { locale, ...rest } = options ?? {};
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...rest,
  });
}

export function formatDateTime(date: Date, locale?: string) {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export function formatTime(date: Date, locale?: string) {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "numeric",
  });
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
): { from: string; to: string } {
  if (isSameDay(from, to)) {
    return {
      from: formatDateTime(from, locale),
      to: formatTime(to, locale),
    };
  }
  const isFromStartDay = startOfDay(from).getTime() === from.getTime();
  const isToEndDay = endOfDay(to).getTime() === to.getTime();
  if (isFromStartDay && isToEndDay) {
    return {
      from: formatDate(from, { locale }),
      to: formatDate(to, { locale }),
    };
  }
  return {
    from: formatDateTime(from, locale),
    to: formatDateTime(to, locale),
  };
}

export function formatDateRange(from?: Date, to?: Date, locale?: string) {
  const sameDay = from && to && isSameDay(from, to);
  const isFromStartDay = from && startOfDay(from).getTime() === from.getTime();
  const isToEndDay = to && endOfDay(to).getTime() === to.getTime();

  if (sameDay) {
    if (from.getTime() === to.getTime()) {
      return formatDateTime(from, locale);
    }
    if (from && to) {
      return `${formatDateTime(from, locale)} - ${formatTime(to, locale)}`;
    }
  }

  if (from && to) {
    if (isFromStartDay && isToEndDay) {
      return `${formatDate(from, { locale })} - ${formatDate(to, { locale })}`;
    }
    return `${formatDateTime(from, locale)} - ${formatDateTime(to, locale)}`;
  }

  if (to) {
    return `Until ${formatDateTime(to, locale)}`;
  }

  if (from) {
    return `Since ${formatDateTime(from, locale)}`;
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
