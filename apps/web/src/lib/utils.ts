import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { format } from "date-fns";
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
