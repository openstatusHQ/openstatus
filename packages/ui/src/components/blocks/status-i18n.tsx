"use client";

import type {
  StatusReportImpact,
  StatusReportUpdateType,
  StatusType,
  ThemeValue,
} from "@openstatus/ui/components/blocks/status.types";
import { defaultStatusBlocksLabels } from "@openstatus/ui/components/blocks/status.utils";
import { createContext, useContext, useMemo } from "react";

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
  componentImpact: Record<StatusReportImpact, string>;

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

  /** Heading shown on the status-calendar block. */
  calendarTitle: string;

  durationFor: (s: string) => string;
  durationAcross: (s: string) => string;

  formatDate: (d: Date) => string;
  formatDateShort: (d: Date) => string;
  formatDateTime: (d: Date) => string;
  /**
   * A status bar's calendar day from its `YYYY-MM-DD` key. Unlike the
   * instant formatters above it must not shift the date into a time zone.
   */
  formatDay: (day: string) => string;
  /** Compact banner stamp such as `Oct 03, 2026 14:41 (UTC)`. */
  formatTimestamp: (d: Date) => string;
  /**
   * IANA zone the formatters render in, when not UTC. The rich timestamp
   * hover card adds a row for it next to the viewer's zone and UTC.
   */
  timeZone?: string;
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

/** Provider input: formatters added after the first release fall back to the defaults. */
export type StatusBlocksLabelsInput = Omit<
  StatusBlocksLabels,
  "formatDay" | "formatTimestamp"
> &
  Partial<Pick<StatusBlocksLabels, "formatDay" | "formatTimestamp">>;

const StatusBlocksLabelsContext = createContext<StatusBlocksLabels | null>(
  null,
);

export function StatusBlocksI18nProvider({
  value,
  children,
}: {
  value: StatusBlocksLabelsInput;
  children: React.ReactNode;
}) {
  const labels = useMemo<StatusBlocksLabels>(
    () => ({
      formatDay: defaultStatusBlocksLabels.formatDay,
      formatTimestamp: defaultStatusBlocksLabels.formatTimestamp,
      ...value,
    }),
    [value],
  );
  return (
    <StatusBlocksLabelsContext.Provider value={labels}>
      {children}
    </StatusBlocksLabelsContext.Provider>
  );
}

export function useStatusBlocksLabels(): StatusBlocksLabels {
  return useContext(StatusBlocksLabelsContext) ?? defaultStatusBlocksLabels;
}
