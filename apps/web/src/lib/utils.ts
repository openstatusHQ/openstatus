import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { addDays, format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatDate(date: Date) {
  return format(date, "LLL dd, y");
}

export function formatDateTime(date: Date) {
  return format(date, "LLL dd, y HH:mm:ss");
}

export function formatTime(date: Date) {
  return format(date, "HH:mm:ss");
}

export function formatDuration(ms: number) {
  let v = ms;
  if (ms < 0) v = -ms;
  const time = {
    day: Math.floor(v / 86400000),
    hour: Math.floor(v / 3600000) % 24,
    min: Math.floor(v / 60000) % 60,
    sec: Math.floor(v / 1000) % 60,
    ms: Math.floor(v) % 1000,
  };
  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val} ${key}${val !== 1 && key !== "ms" ? "s" : ""}`)
    .join(", ");
}

export function notEmpty<TValue>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

export const slugify = (str: string) => {
  return str
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");
};

export async function copyToClipboard(value: string) {
  navigator.clipboard.writeText(value);
}

export function numberFormatter(value: number) {
  const formatter = Intl.NumberFormat("en", { notation: "compact" });
  return formatter.format(value);
}

/**
 * Whenever you select a date, it will use the midnight timestamp of that date.
 * We need to add a day minus one second to include the whole day.
 */
export function manipulateDate(
  date?: {
    from: Date | undefined;
    to?: Date | undefined;
  } | null,
) {
  const isToDateMidnight = String(date?.to?.getTime()).endsWith("00000");

  // We might wanna use `endOfDay(new Date(date.to))` here
  const addOneDayToDate = date?.to
    ? addDays(new Date(date.to), 1).getTime() - 1
    : null;

  return {
    fromDate: date?.from?.getTime() || null,
    toDate: isToDateMidnight ? addOneDayToDate : date?.to?.getTime() || null,
  };
}

export function toCapitalize(inputString: string) {
  const words = inputString.split(/[\s_]+/); // Split the input string by spaces or underscores

  // Capitalize the first letter of each word
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}
