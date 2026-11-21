import {
  formatChartDateTime,
  formatChartTick,
} from "@openstatus/ui/lib/chart-latency";
import {
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isSameMinute,
  isSameYear,
  startOfDay,
} from "date-fns";

import type { PERIODS } from "@/data/metrics.client";

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

/** Splits "120 ms" into the number and its unit; anything else has no unit. */
export function splitUnit(formatted: string) {
  const match = /^(-?[\d.,]+)\s*([a-zA-Z]+)$/.exec(formatted);
  return match
    ? { value: match[1], unit: match[2] }
    : { value: formatted, unit: null };
}

export function formatPercentage(value: number, fractionDigits = 2) {
  if (Number.isNaN(value)) return "100%";
  return `${Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}`;
}

export function formatNumber(value: number) {
  return `${Intl.NumberFormat("en-US").format(value)}`;
}

// TODO: think of supporting custom formats

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date) {
  return formatChartDateTime(date.getTime());
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
  });
}

export function formatAxisTick(
  date: Date,
  period: (typeof PERIODS)[number],
  interval: number,
) {
  return formatChartTick(date.getTime(), {
    timeRange: period,
    intervalMinutes: interval,
  });
}

export function formatDateRange(from?: Date, to?: Date) {
  const sameDay = from && to && isSameDay(from, to);
  const isFromStartDay = from && startOfDay(from).getTime() === from.getTime();
  const isToEndDay = to && endOfDay(to).getTime() === to.getTime();

  if (sameDay) {
    if (from && to) {
      return `${formatDateTime(from)} - ${formatTime(to)}`;
    }
  }

  if (from && to) {
    if (isFromStartDay && isToEndDay) {
      return `${formatDate(from)} - ${formatDate(to)}`;
    }
    return `${formatDateTime(from)} - ${formatDateTime(to)}`;
  }

  if (to) {
    return `Until ${formatDateTime(to)}`;
  }

  if (from) {
    return `Since ${formatDateTime(from)}`;
  }

  return "All time";
}

export function formatDistanceToNowShort(date: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** "4h", "2h 10m", "2d 3h", "45m", "12s": the two largest units at most. */
export function formatDurationShort(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  // from a minute up, round to whole minutes so it agrees with the "HH:mm – HH:mm" window beside it
  const total = seconds < 60 ? seconds : Math.round(seconds / 60) * 60;
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function formatClock(date: Date): string {
  return format(date, "HH:mm");
}

/**
 * Row date, read against `now`: earlier today "22:12", later today "Today",
 * the coming week "Tue 20", otherwise "Oct 04" with the year once it differs.
 */
export function formatEventDate(date: Date, now = new Date()): string {
  if (isSameDay(date, now)) return date <= now ? formatClock(date) : "Today";
  const days = differenceInCalendarDays(date, now);
  // zero-padded days keep the mono date column one width
  if (days > 0 && days < 7) return format(date, "EEE dd");
  return format(date, isSameYear(date, now) ? "MMM dd" : "MMM dd, yyyy");
}

/** "14:00" today, else "Oct 14, 14:00": open spans can start or end on another day. */
export function formatClockOrDay(date: Date, now = new Date()): string {
  return isSameDay(date, now)
    ? formatClock(date)
    : format(date, "MMM d, HH:mm");
}

/** Under a day "02:00 – 06:00", else "Oct 11 – Oct 15" (with years when they differ); the row's date carries the day. */
export function formatWindow(from: Date, to: Date): string {
  // "23:33 – 23:33" reads like a typo
  if (isSameMinute(from, to)) return formatClock(from);
  const short = to.getTime() - from.getTime() < 24 * 60 * 60 * 1000;
  const pattern = short
    ? "HH:mm"
    : isSameYear(from, to)
      ? "MMM d"
      : "MMM d, yyyy";
  return `${format(from, pattern)} – ${format(to, pattern)}`;
}
