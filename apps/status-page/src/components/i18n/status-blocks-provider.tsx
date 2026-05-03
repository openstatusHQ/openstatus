"use client";

import {
  formatDate,
  formatDateRange,
  formatDateRangeParts,
  formatDateTime,
} from "@/lib/formatter";
import {
  StatusBlocksI18nProvider,
  type StatusBlocksLabels,
} from "@openstatus/ui/components/blocks/status-i18n";
import { useExtracted, useLocale } from "next-intl";
import { useMemo } from "react";

/**
 * StatusBlocksProvider
 *
 * Bridges next-intl translations + locale-aware date formatters into the
 * `@openstatus/ui` blocks. Mounted once at the locale layout — every block
 * rendered below it (banner, bar, component, events, feed, blank) reads
 * translated labels via `useStatusBlocksLabels()`.
 *
 * Extractor note: the t("…") keys below must remain literal strings so the
 * next-intl extractor can pick them up from `apps/status-page/src/...`.
 */
export function StatusBlocksProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useExtracted();
  const locale = useLocale();

  const value = useMemo<StatusBlocksLabels>(
    () => ({
      systemStatus: {
        success: {
          long: t("All Systems Operational"),
          short: t("Operational"),
        },
        degraded: { long: t("Degraded Performance"), short: t("Degraded") },
        error: { long: t("Downtime Performance"), short: t("Downtime") },
        info: { long: t("Maintenance"), short: t("Maintenance") },
        empty: { long: t("No Data"), short: t("No Data") },
      },
      incidentStatus: {
        resolved: t("Resolved"),
        monitoring: t("Monitoring"),
        identified: t("Identified"),
        investigating: t("Investigating"),
      },
      requestStatus: {
        success: t("Normal"),
        degraded: t("Degraded"),
        error: t("Error"),
        info: t("Maintenance"),
        empty: t("No Data"),
      },

      today: t("today"),
      ongoing: t("ongoing"),
      reportResolved: t("Report resolved"),
      noRecentNotifications: t("No recent notifications"),
      noRecentNotificationsDescription: t(
        "There have been no reports within the last 7 days.",
      ),
      noReports: t("No reports found"),
      noReportsDescription: t("No reports found for this status page."),
      noPublicMonitors: t("No public monitors"),
      noPublicMonitorsDescription: t(
        "No public monitors have been added to this page.",
      ),

      themeNames: {
        light: t("Light"),
        dark: t("Dark"),
        system: t("System"),
      },
      ariaToggleTheme: t("Toggle theme"),

      subscribe: t("Get updates"),
      subscribeRssDescription: t("Get the RSS feed"),
      subscribeAtomDescription: t("Get the Atom feed"),
      subscribeJsonDescription: t("Get the JSON updates"),
      subscribeSlackDescription: t(
        "For status updates in Slack, paste the text below into any channel.",
      ),
      subscribeSshDescription: t("Get status via SSH"),
      linkCopiedToClipboard: t("Link copied to clipboard"),
      ariaCopyLink: t("Copy Link"),

      poweredBy: t("powered by"),
      getInTouch: t("Get in touch"),

      ariaStatusTracker: t("Status tracker"),
      ariaDayStatus: (n: number) => t("Day {n} status", { n: String(n) }),
      clickAgainToUnpin: t("Click again to unpin"),

      durationIn: (duration: string) => t("(in {duration})", { duration }),
      durationEarlier: (timeFromLast: string) =>
        t("({timeFromLast} earlier)", { timeFromLast }),
      durationFor: (duration: string) => t("(for {duration})", { duration }),
      durationAcross: (duration: string) =>
        t("across {duration}", { duration }),

      formatDate: (d: Date) => formatDate(d, { locale }),
      formatDateShort: (d: Date) => formatDate(d, { month: "short", locale }),
      formatDateTime: (d: Date) => formatDateTime(d, locale),
      formatDateRange: (from?: Date, to?: Date) =>
        formatDateRange(from, to, locale),
      formatDateRangeParts: (from: Date, to: Date) =>
        formatDateRangeParts(from, to, locale),
    }),
    [t, locale],
  );

  return (
    <StatusBlocksI18nProvider value={value}>
      {children}
    </StatusBlocksI18nProvider>
  );
}
