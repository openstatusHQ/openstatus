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
	const sameDay = from && to && isSameDay(from, to);
	const isFromStartDay = from && startOfDay(from).getTime() === from.getTime();
	const isToEndDay = to && endOfDay(to).getTime() === to.getTime();

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
	});
}

import type {
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
