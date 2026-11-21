"use client";

import { Info, Lock } from "@openstatus/icons";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { columns as monthColumns } from "@/components/data-table/monitor-report-months/columns";
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
import { UptimeMetricTabs } from "@/components/metric/uptime-metric-tabs";
import { CheckSuccessHeatmap } from "@/components/monitor-report/check-success-heatmap";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  exampleReportMonths,
  formatAvailability,
  rarelyOpensOutages,
  reportRange,
} from "@/data/monitor-report.client";
import { exampleUptimeCounts } from "@/data/uptime-history.client";
import { useNow } from "@/hooks/use-now";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const monitorId = Number.parseInt(id);
  const trpc = useTRPC();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [{ metric: requestedMetric }, setSearchParams] =
    useQueryStates(searchParamsParsers);

  // recomputed when the UTC month rolls over under an open tab
  const now = useNow(60_000);
  const utcMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const range = useMemo(() => reportRange(new Date()), [utcMonth]);

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: monitorId }),
  );
  const { data: report } = useQuery({
    ...trpc.monitorIncident.report.queryOptions({
      monitorId,
      ...range,
    }),
    placeholderData: (previous) => previous,
  });
  const isLimited = workspace?.limits["uptime-history"] === false;
  const { data: history } = useQuery({
    ...trpc.monitor.getUptimeHistory.queryOptions({ id: monitorId }),
    enabled: !!workspace && !isLimited,
  });

  if (!workspace || !monitor || !report) return null;

  // a failed runs read keeps the tab so its warning still shows
  const showMetric =
    !isLimited &&
    !!history?.runs &&
    (history.runs.length > 0 || history.runsPartial);
  const metric = showMetric ? requestedMetric : "requests";
  const counts = isLimited
    ? exampleUptimeCounts()
    : ((metric === "runs" ? history?.runs : history?.days) ?? []);
  const partial = metric === "runs" ? history?.runsPartial : history?.partial;

  const upgrade = (description: string) => (
    <BillingOverlay>
      <BillingOverlayButton
        data-track="paywall_viewed"
        data-limit="uptime-history"
        onClick={() => setUpgradeOpen(true)}
      >
        <Lock />
        Upgrade
      </BillingOverlayButton>
      <BillingOverlayDescription>{description}</BillingOverlayDescription>
    </BillingOverlay>
  );

  const monthsTable = (
    <div
      aria-hidden={isLimited}
      className={cn(
        "overflow-x-auto",
        isLimited && "pointer-events-none select-none",
      )}
    >
      <DataTable
        columns={monthColumns}
        data={isLimited ? exampleReportMonths() : report.months}
        defaultPagination={{ pageIndex: 0, pageSize: 24 }}
      />
    </div>
  );

  return (
    <SectionGroup>
      <Section id="history">
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            Availability over the last 12 months from outages, with monthly
            figures and daily check success. Months and days in UTC.
          </SectionDescription>
        </SectionHeader>
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
        <MetricStrip>
          <MetricStripRow>
            <MetricStripItem>
              <MetricStripLabel>Availability</MetricStripLabel>
              <MetricStripValue>
                {formatAvailability(report.availability)}
              </MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Downtime</MetricStripLabel>
              <MetricStripValue>
                {report.downtimeMs > 0
                  ? formatDurationShort(report.downtimeMs)
                  : "—"}
                {report.excusedMs > 0 ? (
                  <MetricStripAside>
                    {formatDurationShort(report.excusedMs)} excused
                  </MetricStripAside>
                ) : null}
              </MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Outages</MetricStripLabel>
              <MetricStripValue>{report.outageCount}</MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Longest outage</MetricStripLabel>
              <MetricStripValue>
                {report.longestMs === null
                  ? "—"
                  : formatDurationShort(report.longestMs)}
              </MetricStripValue>
            </MetricStripItem>
            <MetricStripItem>
              <MetricStripLabel>Mean time to resolve</MetricStripLabel>
              <MetricStripValue>
                {report.mttrMs === null
                  ? "—"
                  : formatDurationShort(report.mttrMs)}
              </MetricStripValue>
            </MetricStripItem>
          </MetricStripRow>
        </MetricStrip>
        {rarelyOpensOutages(monitor) ? (
          <Note size="sm">
            <Info />
            {monitor.jobType === "heartbeat"
              ? report.availability === null
                ? "Nothing was measured in this period. A heartbeat's availability starts with its first ping."
                : "Heartbeat monitors open an outage only when a ping is missed or fails, so availability often reads 100%."
              : "Monitors checked only from private locations rarely open outages, so availability often reads 100%."}
          </Note>
        ) : null}
      </Section>
      <Section id="months">
        <SectionHeader>
          <SectionTitle>Months</SectionTitle>
          <SectionDescription>
            Availability per month in UTC. Excused outages count as up.
          </SectionDescription>
        </SectionHeader>
        {isLimited ? (
          <BillingOverlayContainer>
            {monthsTable}
            {upgrade("See every month of availability.")}
          </BillingOverlayContainer>
        ) : (
          monthsTable
        )}
      </Section>
      <Section id="check-success">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Check success rate</SectionTitle>
            <SectionDescription>
              Share of {metric} that passed each day, independent of outages.
            </SectionDescription>
          </SectionHeader>
          {showMetric ? (
            <UptimeMetricTabs
              value={metric}
              onValueChange={(m) => setSearchParams({ metric: m })}
            />
          ) : null}
        </SectionHeaderRow>
        {isLimited ? (
          <BillingOverlayContainer>
            <CheckSuccessHeatmap counts={counts} metric={metric} limited />
            {upgrade(
              "Keep every day of your monitor's uptime, year after year.",
            )}
          </BillingOverlayContainer>
        ) : (
          <CheckSuccessHeatmap
            counts={counts}
            metric={metric}
            partial={partial}
            reportFrom={report.window.from}
          />
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
