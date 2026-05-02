"use client";

import { createContext, useContext } from "react";
import { defaultStatusBlocksLabels } from "@openstatus/ui/components/blocks/status.utils";
import type {
	StatusReportUpdateType,
	StatusType,
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
