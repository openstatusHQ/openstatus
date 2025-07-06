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

export function formatPercentage(value: number) {
  return `${Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "numeric",
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

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
