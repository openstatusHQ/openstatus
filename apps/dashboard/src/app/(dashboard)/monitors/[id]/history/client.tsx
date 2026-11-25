"use client";

import { Info, Lock } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useMemo, useState } from "react";

import { Note, NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import {
  MetricStrip,
  MetricStripAside,
  MetricStripItem,
  MetricStripLabel,
  MetricStripRow,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import { MonitorHistoryOverview } from "@/components/monitor-history/monitor-history-overview";
import { PeriodSelect } from "@/components/status-page-history/period-select";
import {
  type Checks,
  checkSuccess,
  historyMonths,
  sumChecks,
} from "@/data/monitor-history.client";
import {
  exampleReportMonths,
  formatAvailability,
  rarelyOpensOutages,
  reportRange,
} from "@/data/monitor-report.client";
import {
  type CheckCounts,
  checkHistorySince,
  historyPeriodMonths,
  exampleUptimeCounts,
} from "@/data/uptime-history.client";
import { useNow } from "@/hooks/use-now";
import { formatDurationShort, formatNumber } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

function ChecksItem({
  label,
  checks,
}: {
  label: string;
  checks: Checks | null;
}) {
  return (
    <MetricStripItem>
      <MetricStripLabel>{label}</MetricStripLabel>
      <MetricStripValue>
        {formatAvailability(checkSuccess(checks))}
        {checks && checks.error > 0 ? (
          <MetricStripAside className="hidden @3xl:inline">
            {formatNumber(checks.error)} failed
          </MetricStripAside>
        ) : null}
      </MetricStripValue>
    </MetricStripItem>
  );
}

export function Client() {
  const { id } = useParams<{ id: string }>();
  const monitorId = Number.parseInt(id);
  const trpc = useTRPC();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [{ source: requestedSource, period, month }, setSearchParams] =
    useQueryStates(searchParamsParsers);

  // recomputed when the UTC month rolls over under an open tab
  const now = useNow(60_000);
  const utcMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const historyLimit = workspace?.limits["uptime-history"] ?? 0;
  const isLimited = !!workspace && historyLimit === 0;
  const periodMonths = historyPeriodMonths(period, historyLimit);
  const range = useMemo(
    () => reportRange(new Date(), periodMonths),
    [utcMonth, periodMonths],
  );

  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: monitorId }),
  );
  const { data: report } = useQuery({
    ...trpc.monitorIncident.report.queryOptions({ monitorId, ...range }),
    placeholderData: (previous) => previous,
  });
  const { data: history } = useQuery({
    ...trpc.monitor.getUptimeHistory.queryOptions({ id: monitorId }),
    enabled: !!workspace && !isLimited,
  });

  const examples = useMemo(
    () =>
      isLimited
        ? { months: exampleReportMonths(), requests: exampleUptimeCounts() }
        : null,
    [isLimited],
  );

  if (!workspace || !monitor || !report) return null;

  const reportMonths = examples?.months ?? report.months;
  const from = reportMonths[0]?.month.slice(0, 10) ?? "";
  const inWindow = (counts: CheckCounts[]) =>
    counts.filter((c) => c.day >= from);
  const requests = inWindow(examples?.requests ?? history?.days ?? []);
  const runs = inWindow(history?.runs ?? []);
  // a failed runs read keeps the tab so its warning still shows
  const showRuns =
    !isLimited &&
    !!history?.runs &&
    (history.runs.length > 0 || history.runsPartial);
  const source =
    requestedSource === "runs" && !showRuns ? "requests" : requestedSource;
  const incidents = examples ? [] : report.incidents;
  const months = historyMonths(reportMonths, incidents, requests, runs);
  const since = checkHistorySince(history?.days ?? []);
  const partial = source === "runs" ? history?.runsPartial : history?.partial;

  const overview = (
    <MonitorHistoryOverview
      title={monitor.name}
      months={months}
      incidents={incidents}
      requests={requests}
      runs={runs}
      showRuns={showRuns}
      source={source}
      onSourceChange={(next) =>
        setSearchParams({ source: next === "outages" ? null : next })
      }
      month={month}
      onMonthChange={(next) => setSearchParams({ month: next })}
      now={now}
    />
  );

  return (
    <SectionGroup>
      <Section id="history">
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            {isLimited
              ? "Example data. Upgrade to keep your monitor's history."
              : source === "outages"
                ? "Downtime per month from outages. Excused outages count as up."
                : `Share of ${source} that passed, independent of outages.`}
          </SectionDescription>
        </SectionHeader>
        {!isLimited ? (
          <div>
            {source === "outages"
              ? "Availability from outages"
              : `Check success from ${source}`}{" "}
            over the{" "}
            <PeriodSelect
              value={periodMonths}
              limit={historyLimit}
              // a month outside the new period would linger in the URL
              onValueChange={(next) =>
                setSearchParams({ period: next, month: null })
              }
            />
            . Months and days in UTC.
          </div>
        ) : null}
        {!isLimited ? (
          <NoteDismissible cookieKey="note_reports_global_monitors">
            <Info />
            Need one report across all your monitors? Let us know.
            <FormDialogSupportContact
              defaultValues={{
                type: "feature",
                message:
                  "I'm interested in a report across all my monitors. What I need: ",
              }}
            >
              <NoteButton variant="default">Tell us what you need</NoteButton>
            </FormDialogSupportContact>
          </NoteDismissible>
        ) : null}
        {source === "outages" && rarelyOpensOutages(monitor) ? (
          <Note size="sm">
            <Info />
            {monitor.jobType === "heartbeat"
              ? report.availability === null
                ? "Nothing was measured in this period. A heartbeat's availability starts with its first ping."
                : "Heartbeat monitors open an outage only when a ping is missed or fails, so availability often reads 100%."
              : "Monitors checked only from private locations rarely open outages, so availability often reads 100%."}
          </Note>
        ) : null}
        {source !== "outages" && !isLimited && since && since > from ? (
          <Note size="sm">
            <Info />
            Check history starts {format(parseISO(since), "MMM d, yyyy")}.
            Availability before that comes from outage records.
          </Note>
        ) : null}
        {source !== "outages" && !isLimited && partial ? (
          <Note color="warning" size="sm">
            <Info />
            Recent {source} couldn&apos;t be loaded, so the last few weeks may
            be incomplete.
          </Note>
        ) : null}
        <MetricStrip>
          <MetricStripRow>
            <MetricStripItem>
              <MetricStripLabel>Availability</MetricStripLabel>
              <MetricStripValue>
                {formatAvailability(report.availability)}
                <MetricStripAside className="hidden @3xl:inline">
                  outages
                </MetricStripAside>
              </MetricStripValue>
            </MetricStripItem>
            {isLimited ? null : (
              <>
                <ChecksItem label="Requests" checks={sumChecks(requests)} />
                {showRuns ? (
                  <ChecksItem label="Runs" checks={sumChecks(runs)} />
                ) : null}
              </>
            )}
            <MetricStripItem>
              <MetricStripLabel>Downtime</MetricStripLabel>
              <MetricStripValue>
                {report.downtimeMs > 0
                  ? formatDurationShort(report.downtimeMs)
                  : "—"}
                {report.excusedMs > 0 ? (
                  <MetricStripAside className="hidden @3xl:inline">
                    {formatDurationShort(report.excusedMs)} excused
                  </MetricStripAside>
                ) : null}
              </MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Outages</MetricStripLabel>
              <MetricStripValue>{report.outageCount}</MetricStripValue>
            </MetricStripItem>
          </MetricStripRow>
        </MetricStrip>
      </Section>
      <Section id="history-overview">
        {isLimited ? (
          <BillingOverlayContainer>
            <Section
              aria-hidden
              inert
              className="pointer-events-none select-none"
            >
              {overview}
            </Section>
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="uptime-history"
                onClick={() => setUpgradeOpen(true)}
              >
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep every day of your monitor&apos;s uptime, year after year.
              </BillingOverlayDescription>
            </BillingOverlay>
          </BillingOverlayContainer>
        ) : (
          overview
        )}
      </Section>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limit="uptime-history"
      />
    </SectionGroup>
  );
}
