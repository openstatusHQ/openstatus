export type Locale = { locale?: string; timeZone?: string };

export type TimeStyle = "time" | "day" | "full";

const DAY = { month: "short", day: "numeric" } as const;
const TIME = { hour: "2-digit", minute: "2-digit" } as const;
const TIME_STYLES = { time: TIME, day: DAY, full: { ...DAY, ...TIME } };

export function formatNumber(value: number, { locale }: Locale): string {
  return value.toLocaleString(locale);
}

export function formatMs(value: number, locale: Locale): string {
  return `${formatNumber(value, locale)} ms`;
}

export function formatInterval(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}min`;
}

export function formatTime(
  timestamp: number,
  style: TimeStyle,
  { locale, timeZone }: Locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...TIME_STYLES[style],
    timeZone,
  }).format(timestamp);
}
