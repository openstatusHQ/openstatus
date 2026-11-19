"use client";

import { Info, Lock, Success } from "@openstatus/icons";
import { DatePickerWithRange } from "@openstatus/ui/components/custom/date-picker-with-range";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  EventGroup,
  EventGroupCount,
  EventGroupHeader,
  EventGroupTitle,
} from "@/components/content/event-group";
import { EventList, EventListMore } from "@/components/content/event-list";
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
  MetricCard,
  MetricCardDetail,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { UptimeMetricTabs } from "@/components/metric/uptime-metric-tabs";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import { CheckSuccessHeatmap } from "@/components/monitor-report/check-success-heatmap";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  REPORT_PERIOD_LABELS,
  REPORT_PERIODS,
  type ReportPeriod,
  exampleReportMonths,
  formatAvailability,
  reportRange,
} from "@/data/monitor-report";
import { exampleUptimeCounts } from "@/data/uptime-history.client";
import { usePaged } from "@/hooks/use-paged";
import { formatDurationShort } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

const toDay = (date: Date) => format(date, "yyyy-MM-dd");
const utcDay = (date: Date) => date.toISOString().slice(0, 10);
// the picker works in local dates; put each UTC day on the same calendar day
const asLocalDay = (date: Date) =>
  new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
const fromDay = (day: string | null) => {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function Client() {
  const { id } = useParams<{ id: string }>();
  const monitorId = Number.parseInt(id);
  const trpc = useTRPC();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [{ period, from, to, metric: requestedMetric }, setSearchParams] =
    useQueryStates(searchParamsParsers);

  const range = useMemo(
    () => reportRange({ period, from, to }, new Date()),
    [period, from, to],
  );

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

  const incidents = report?.incidents ?? [];
  const ongoing = incidents.filter((i) => !i.resolvedAt);
  const resolved = incidents.filter((i) => i.resolvedAt);
  const paged = usePaged(resolved);

  const presets = useMemo(
    () =>
      REPORT_PERIODS.filter((p) => p !== "custom").map((p, i) => {
        const r = reportRange({ period: p }, new Date());
        return {
          label: REPORT_PERIOD_LABELS[p],
          shortcut: String(i + 1),
          from: asLocalDay(r.from),
          to: asLocalDay(new Date(r.to.getTime() - 1)),
        };
      }),
    [],
  );

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

  const rarelyOpensOutages =
    monitor.jobType === "heartbeat" ||
    (monitor.regions.length === 0 &&
      (monitor.privateLocations?.length ?? 0) > 0);

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
        isLimited && "pointer-events-none blur-sm select-none",
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
      <Section id="report">
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{monitor.name}</SectionTitle>
            <SectionDescription>
              Availability from outages, with monthly figures and daily check
              success. Months and days in UTC.
            </SectionDescription>
          </SectionHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={period}
              onValueChange={(value) => {
                const next = value as ReportPeriod;
                setSearchParams(
                  next === "custom"
                    ? {
                        period: next,
                        from: utcDay(range.from),
                        to: utcDay(new Date(range.to.getTime() - 1)),
                      }
                    : { period: next, from: null, to: null },
                );
              }}
            >
              <SelectTrigger size="sm" aria-label="Period" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {REPORT_PERIOD_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === "custom" ? (
              <DatePickerWithRange
                date={{ from: fromDay(from), to: fromDay(to) }}
                presets={presets}
                setDate={(date) => {
                  if (!date?.from || !date.to) return;
                  setSearchParams({
                    period: "custom",
                    from: toDay(date.from),
                    to: toDay(date.to),
                  });
                }}
              />
            ) : null}
          </div>
        </SectionHeaderRow>
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
        <MetricCardGroup>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Availability</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {formatAvailability(report.availability)}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Downtime</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {report.downtimeMs > 0
                ? formatDurationShort(report.downtimeMs)
                : "—"}
              {report.excusedMs > 0 ? (
                <MetricCardDetail>
                  {" "}
                  · {formatDurationShort(report.excusedMs)} excused
                </MetricCardDetail>
              ) : null}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Outages</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>{report.outageCount}</MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Longest outage</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {report.longestMs === null
                ? "—"
                : formatDurationShort(report.longestMs)}
            </MetricCardValue>
          </MetricCard>
          <MetricCard>
            <MetricCardHeader>
              <MetricCardTitle>Mean time to resolve</MetricCardTitle>
            </MetricCardHeader>
            <MetricCardValue>
              {report.mttrMs === null
                ? "—"
                : formatDurationShort(report.mttrMs)}
            </MetricCardValue>
          </MetricCard>
        </MetricCardGroup>
        {rarelyOpensOutages ? (
          <Note size="sm">
            <Info />
            {monitor.jobType === "heartbeat"
              ? "Heartbeat monitors open an outage only when a ping is missed or fails, so availability often reads 100%."
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
          />
        )}
      </Section>
      <Section id="outages">
        <SectionHeader>
          <SectionTitle>Outages</SectionTitle>
          <SectionDescription>
            {monitor.jobType === "heartbeat"
              ? "Recorded automatically when a ping is missed or fails."
              : "Recorded automatically when checks fail."}
          </SectionDescription>
        </SectionHeader>
        {incidents.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateMedia variant="success">
              <Success />
            </EmptyStateMedia>
            <EmptyStateTitle>No outages in this period</EmptyStateTitle>
            <EmptyStateDescription>
              {monitor.jobType === "heartbeat"
                ? "A missed or failed ping opens an outage here and alerts the channels linked to this monitor."
                : "A failed check opens an outage here and alerts the channels linked to this monitor."}
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <div className="flex flex-col gap-6">
            {ongoing.length > 0 ? (
              <EventGroup>
                <EventGroupHeader>
                  <EventGroupTitle>
                    Ongoing
                    <EventGroupCount>{ongoing.length}</EventGroupCount>
                  </EventGroupTitle>
                </EventGroupHeader>
                <EventList>
                  {ongoing.map((incident) => (
                    <MonitorIncidentRow key={incident.id} incident={incident} />
                  ))}
                </EventList>
              </EventGroup>
            ) : null}
            <EventGroup>
              <EventGroupHeader>
                <EventGroupTitle>
                  Resolved
                  <EventGroupCount>{resolved.length}</EventGroupCount>
                </EventGroupTitle>
              </EventGroupHeader>
              <EventList>
                {paged.visible.map((incident) => (
                  <MonitorIncidentRow key={incident.id} incident={incident} />
                ))}
                {paged.hasMore ? (
                  <EventListMore onClick={paged.showMore}>
                    Show older
                  </EventListMore>
                ) : null}
              </EventList>
            </EventGroup>
          </div>
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
