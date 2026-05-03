"use client";

import { createContext, useContext } from "react";
import { defaultStatusBlocksLabels } from "@openstatus/ui/components/blocks/status.utils";
import type {
	StatusReportUpdateType,
	StatusType,
	ThemeValue,
} from "@openstatus/ui/components/blocks/status.types";

/**
 * Labels and locale-aware formatters consumed by block components.
 *
 * Blocks read this via `useStatusBlocksLabels()`. When no provider is mounted,
 * the hook returns `defaultStatusBlocksLabels` (English, "en-US" formatting).
 * Apps wanting localized copy should mount `StatusBlocksI18nProvider` and
 * supply translated strings + locale-aware formatters.
 */
export type StatusBlocksLabels = {
	systemStatus: Record<StatusType, { long: string; short: string }>;
	incidentStatus: Record<StatusReportUpdateType, string>;
	requestStatus: Record<StatusType, string>;

	today: string;
	ongoing: string;
	reportResolved: string;
	noRecentNotifications: string;
	noRecentNotificationsDescription: string;
	noReports: string;
	noReportsDescription: string;
	noPublicMonitors: string;
	noPublicMonitorsDescription: string;

	themeNames: Record<ThemeValue, string>;
	ariaToggleTheme: string;

	subscribe: string;
	subscribeRssDescription: string;
	subscribeAtomDescription: string;
	subscribeJsonDescription: string;
	subscribeSlackDescription: string;
	subscribeSshDescription: string;
	linkCopiedToClipboard: string;
	ariaCopyLink: string;

	poweredBy: string;
	getInTouch: string;

	ariaStatusTracker: string;
	ariaDayStatus: (n: number) => string;
	clickAgainToUnpin: string;

	durationIn: (s: string) => string;
	durationEarlier: (s: string) => string;
	durationFor: (s: string) => string;
	durationAcross: (s: string) => string;

	formatDate: (d: Date) => string;
	formatDateShort: (d: Date) => string;
	formatDateTime: (d: Date) => string;
	formatDateRange: (from?: Date, to?: Date) => string;
	/**
	 * Returns the start/end of a closed range as separate strings, so callers
	 * can render each side independently (e.g. wrap each in a hovercard)
	 * without re-parsing the joined output of `formatDateRange`.
	 *
	 * Implementations should collapse same-day ranges (date on `from`, time
	 * only on `to`) the same way `formatDateRange` does.
	 *
	 * Closed ranges only — both `from` and `to` are required. For open-ended
	 * cases (`Since …` / `Until …` / `All time`) use `formatDateRange`.
	 */
	formatDateRangeParts: (from: Date, to: Date) => { from: string; to: string };
};

const StatusBlocksLabelsContext = createContext<StatusBlocksLabels | null>(null);

export function StatusBlocksI18nProvider({
	value,
	children,
}: {
	value: StatusBlocksLabels;
	children: React.ReactNode;
}) {
	return (
		<StatusBlocksLabelsContext.Provider value={value}>
			{children}
		</StatusBlocksLabelsContext.Provider>
	);
}

export function useStatusBlocksLabels(): StatusBlocksLabels {
	return useContext(StatusBlocksLabelsContext) ?? defaultStatusBlocksLabels;
}
