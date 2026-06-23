import { UTCDate } from "@date-fns/utc";
import type { StatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import { endOfDay, isSameDay, startOfDay } from "date-fns";

/**
 * Formats a date range in a human-readable format.
 *
 * NOTE: While Intl.DateTimeFormat.formatRange() is available in modern browsers,
 * we use a custom implementation to have fine-grained control over the output format
 * and to handle edge cases like "Since", "Until", and "All time" consistently.
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatRange
 *
 * @param from - Start date of the range (optional)
 * @param to - End date of the range (optional)
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date range string
 *
 * @example
 * formatDateRange(new Date('2024-01-01'), new Date('2024-01-05'))
 * // => "January 1, 2024 - January 5, 2024"
 *
 * @example
 * formatDateRange(new Date('2024-01-01 10:00'), new Date('2024-01-01 15:00'))
 * // => "January 1, 10:00 AM - 3:00 PM"
 */
export function formatDateRange(from?: Date, to?: Date) {
  const sameDay = from && to && isSameDay(new UTCDate(from), new UTCDate(to));
  const isFromStartDay =
    from && startOfDay(new UTCDate(from)).getTime() === from.getTime();
  const isToEndDay = to && endOfDay(new UTCDate(to)).getTime() === to.getTime();

  if (sameDay) {
    if (from && to && from.getTime() === to.getTime()) {
      return formatDateTime(from);
    }
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

/**
 * Formats a date with locale support.
 *
 * @param date - The date to format
 * @param options - Intl.DateTimeFormatOptions to customize the output
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date string
 */
export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
  locale = "en-US",
) {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
    // last so callers can't override away from UTC (the "(UTC)" label depends on it)
    timeZone: "UTC",
  });
}

/**
 * Formats a date with abbreviated month (e.g. "Jan 15, 2024").
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date string with abbreviated month
 */
export function formatDateShort(date: Date, locale = "en-US") {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats a date with time, with locale support.
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date and time string
 */
export function formatDateTime(date: Date, locale = "en-US") {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats a time with locale support.
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted time string
 */
export function formatTime(date: Date, locale = "en-US") {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Returns the start/end of a closed range as separate strings, collapsing the
 * `to` side to a time-only render when `from` and `to` fall on the same UTC day.
 * Use `formatDateRange` for open-ended cases (`Until …` / `Since …`).
 */
export function formatDateRangeParts(
  from: Date,
  to: Date,
): { from: string; to: string } {
  if (isSameDay(new UTCDate(from), new UTCDate(to))) {
    return { from: formatDateTime(from), to: formatTime(to) };
  }
  const isFromStartDay =
    startOfDay(new UTCDate(from)).getTime() === from.getTime();
  const isToEndDay = endOfDay(new UTCDate(to)).getTime() === to.getTime();
  if (isFromStartDay && isToEndDay) {
    return { from: formatDate(from), to: formatDate(to) };
  }
  return { from: formatDateTime(from), to: formatDateTime(to) };
}

import type {
  StatusReportImpact,
  StatusReportUpdateType,
  StatusType,
} from "@openstatus/ui/components/blocks/status.types";

/**
 * System status display messages
 * Used for displaying status banner and component statuses
 */
export const systemStatusLabels: Record<
  StatusType,
  { long: string; short: string }
> = {
  success: {
    long: "All Systems Operational",
    short: "Operational",
  },
  degraded: {
    long: "Degraded Performance",
    short: "Degraded",
  },
  error: {
    long: "Partial Outage",
    short: "Outage",
  },
  info: {
    long: "Maintenance",
    short: "Maintenance",
  },
  empty: {
    long: "No Data",
    short: "No Data",
  },
} as const;

/**
 * Legacy messages object for backwards compatibility
 * @deprecated Use systemStatusLabels instead
 */
export const messages = {
  long: {
    success: systemStatusLabels.success.long,
    degraded: systemStatusLabels.degraded.long,
    error: systemStatusLabels.error.long,
    info: systemStatusLabels.info.long,
    empty: systemStatusLabels.empty.long,
  },
  short: {
    success: systemStatusLabels.success.short,
    degraded: systemStatusLabels.degraded.short,
    error: systemStatusLabels.error.short,
    info: systemStatusLabels.info.short,
    empty: systemStatusLabels.empty.short,
  },
} as const;

/**
 * Request status labels
 * Used for displaying individual request statuses
 */
export const requestStatusLabels: Record<StatusType, string> = {
  success: "Normal",
  degraded: "Degraded",
  error: "Error",
  info: "Maintenance",
  empty: "No Data",
} as const;

/**
 * Legacy requests object for backwards compatibility
 * @deprecated Use requestStatusLabels instead
 */
export const requests = requestStatusLabels;

/**
 * Component impact labels
 * Used for displaying per-component report impacts
 */
export const componentImpactLabels: Record<StatusReportImpact, string> = {
  operational: "Operational",
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
} as const;

// ordered worst-last so worstImpact can compare by index (mirrors the db's `pageComponentImpact`)
export const statusReportImpacts: readonly StatusReportImpact[] = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
] as const;

export function worstStatusReportImpact(
  impacts: Iterable<StatusReportImpact>,
): StatusReportImpact {
  let worst: StatusReportImpact = "operational";
  for (const impact of impacts) {
    if (
      statusReportImpacts.indexOf(impact) > statusReportImpacts.indexOf(worst)
    ) {
      worst = impact;
    }
  }
  return worst;
}

/**
 * Incident status labels
 * Used for displaying incident report update statuses
 */
export const incidentStatusLabels: Record<StatusReportUpdateType, string> = {
  resolved: "Resolved",
  monitoring: "Monitoring",
  identified: "Identified",
  investigating: "Investigating",
} as const;

/**
 * Legacy status object for backwards compatibility
 * @deprecated Use incidentStatusLabels instead
 */
export const status = incidentStatusLabels;

/**
 * CSS variable mappings for status colors
 * Maps StatusType to corresponding CSS custom properties
 */
export const statusColors: Record<StatusType, string> = {
  success: "var(--success)",
  degraded: "var(--warning)",
  error: "var(--destructive)",
  info: "var(--info)",
  empty: "var(--muted)",
} as const;

/**
 * Legacy colors object for backwards compatibility
 * @deprecated Use statusColors instead
 */
export const colors = statusColors;

// Timestamps render in UTC; the suffix tells viewers which zone.
const withUTC = (value: string) => `${value} (UTC)`;

/**
 * Default labels consumed by blocks when no StatusBlocksI18nProvider is mounted.
 * Registry/web preview render with this set; the status-page app overrides via the provider.
 */
export const defaultStatusBlocksLabels = {
  systemStatus: systemStatusLabels,
  incidentStatus: incidentStatusLabels,
  requestStatus: requestStatusLabels,
  componentImpact: componentImpactLabels,

  today: "Today",
  ongoing: "Ongoing",
  reportResolved: "Report resolved",
  noRecentNotifications: "No recent notifications",
  noRecentNotificationsDescription:
    "There have been no reports within the last 7 days.",
  noReports: "No reports",
  noReportsDescription: "There are no reports to display.",
  noPublicMonitors: "No public monitors",
  noPublicMonitorsDescription: "There are no public monitors to display.",

  themeNames: {
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  ariaToggleTheme: "Toggle theme",

  subscribe: "Get updates",
  subscribeRssDescription: "Get the RSS feed",
  subscribeAtomDescription: "Get the Atom feed",
  subscribeJsonDescription: "Get the JSON updates",
  subscribeSlackDescription:
    "For status updates in Slack, paste the text below into any channel.",
  subscribeSshDescription: "Get status via SSH",
  linkCopiedToClipboard: "Link copied to clipboard",
  ariaCopyLink: "Copy Link",

  poweredBy: "powered by",
  getInTouch: "Get in touch",

  ariaStatusTracker: "Status tracker",
  ariaDayStatus: (n: number) => `Day ${n} status`,
  clickAgainToUnpin: "Click again to unpin",

  calendarTitle: "Calendar",

  durationIn: (s: string) => `(in ${s})`,
  durationEarlier: (s: string) => `(${s} earlier)`,
  durationFor: (s: string) => `(for ${s})`,
  durationAcross: (s: string) => `across ${s}`,

  formatDate: (d: Date) => withUTC(formatDate(d)),
  formatDateShort: (d: Date) => withUTC(formatDateShort(d)),
  formatDateTime: (d: Date) => withUTC(formatDateTime(d)),
  formatDateRange: (from?: Date, to?: Date) => {
    const range = formatDateRange(from, to);
    return from || to ? withUTC(range) : range;
  },
  formatDateRangeParts: (from: Date, to: Date) => {
    const { from: start, to: end } = formatDateRangeParts(from, to);
    return { from: start, to: withUTC(end) };
  },
} as const satisfies StatusBlocksLabels;
