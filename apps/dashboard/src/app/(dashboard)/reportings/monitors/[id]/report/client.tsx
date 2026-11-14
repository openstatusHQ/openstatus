"use client";

import type { RouterOutputs } from "@openstatus/api";
import { FileText } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";

import { Note } from "@/components/common/note";
import { StatusBadge } from "@/components/common/status-badge";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { columns as componentColumns } from "@/components/data-table/monitor-reporting-report-components/columns";
import { getColumns as getDowntimeColumns } from "@/components/data-table/monitor-reporting-report-downtime/columns";
import { getColumns as getExcusedColumns } from "@/components/data-table/monitor-reporting-report-excused/columns";
import { getColumns as getMaintenanceColumns } from "@/components/data-table/monitor-reporting-report-maintenance/columns";
import { getColumns as getResultColumns } from "@/components/data-table/monitor-reporting-report-results/columns";
import { ReportingPaywall } from "@/components/reportings/reporting-paywall";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import {
  allowedDowntime,
  completeSlaMonths,
  formatSlaInstant,
  formatSlaMonth,
  formatSlaTarget,
} from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

type Report = RouterOutputs["monitorReporting"]["report"];

const MONTHS_OFFERED = 24;

// the dashboard chrome is rendered by parent layouts, so the print rules reach it from here
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 14mm; }
  [data-slot=sidebar-gap], [data-slot=sidebar-container],
  [data-slot=sidebar-inset] > div > header,
  [data-slot=sidebar-inset] > div > nav { display: none !important; }
  [data-slot=sidebar-inset] { margin: 0 !important; border: 0 !important; box-shadow: none !important; }
}`;

const monthLong = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export function Client() {
  const { id } = useParams<{ id: string }>();
  const policyId = Number.parseInt(id);
  const trpc = useTRPC();
  const [monthParam, setMonth] = useQueryState(
    "month",
    searchParamsParsers.month,
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const allowed = workspace?.limits["monitor-sla"] === true;
  const { data: summary } = useQuery({
    ...trpc.monitorReporting.summary.queryOptions({ id: policyId }),
    enabled: allowed,
  });
  const offered = useMemo(
    () => (summary ? completeSlaMonths(summary.timeZone, MONTHS_OFFERED) : []),
    [summary],
  );
  const month = monthParam ?? offered[0]?.slice(0, 7);
  const options =
    month && !offered.some((m) => m.startsWith(month))
      ? [`${month}-01`, ...offered]
      : offered;
  const {
    data: report,
    error,
    isPlaceholderData,
  } = useQuery({
    ...trpc.monitorReporting.report.queryOptions({
      id: policyId,
      month: month ?? "",
    }),
    enabled: allowed && !!month,
    placeholderData: keepPreviousData,
  });

  // the printed report is a document: always light, whatever the dashboard theme
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = root.classList.contains("dark");
      root.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) root.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  if (!workspace) return null;
  if (!allowed) return <ReportingPaywall />;

  return (
    <SectionGroup
      data-slot="report"
      className="print:max-w-none print:space-y-6 print:p-0 print:[&_[data-slot=section]]:break-inside-avoid print:[&_a]:text-inherit print:[&_a]:no-underline print:[&_tr]:break-inside-avoid"
    >
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Select
          value={month}
          onValueChange={(value) => void setMonth(value)}
          disabled={options.length === 0}
        >
          <SelectTrigger size="sm" aria-label="Month" className="w-44">
            <SelectValue placeholder="Month">
              {month ? formatSlaMonth(`${month}-01`, { year: true }) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={m.slice(0, 7)}>
                {formatSlaMonth(m, { year: true })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={!report || report.empty}
          onClick={() => window.print()}
        >
          Print or save as PDF
        </Button>
      </div>
      {error ? (
        <EmptyStateContainer>
          <EmptyStateMedia>
            <FileText />
          </EmptyStateMedia>
          <EmptyStateTitle>Could not load the report</EmptyStateTitle>
          <EmptyStateDescription>
            {error.data?.code === "BAD_REQUEST"
              ? error.message
              : "Something went wrong while loading it. Try again."}
          </EmptyStateDescription>
        </EmptyStateContainer>
      ) : report ? (
        <div
          aria-busy={isPlaceholderData}
          className={cn(
            "space-y-8 transition-opacity print:space-y-6",
            isPlaceholderData && "opacity-60",
          )}
        >
          <ReportBody report={report} />
        </div>
      ) : null}
    </SectionGroup>
  );
}

function ReportBody({ report }: { report: Report }) {
  const { policy, terms } = report;
  const { timeZone } = policy;
  const final = report.state === "final";
  const met = report.monitors.filter((m) => m.met === true).length;
  const judged = report.monitors.filter((m) => m.met !== null).length;
  const resultColumns = useMemo(
    () => getResultColumns({ credits: terms.creditSchedule !== null }),
    [terms.creditSchedule],
  );
  const downtimeColumns = useMemo(
    () => getDowntimeColumns({ timeZone }),
    [timeZone],
  );
  const excusedColumns = useMemo(
    () => getExcusedColumns({ timeZone }),
    [timeZone],
  );
  const maintenanceColumns = useMemo(
    () => getMaintenanceColumns({ timeZone }),
    [timeZone],
  );

  return (
    <>
      <Section id="report">
        <SectionHeaderRow>
          <SectionHeader>
            <h1 className="text-lg font-medium">
              {policy.name}: availability report
            </h1>
            <SectionDescription>
              {monthLong(report.month)}, calendar month in {timeZone}
            </SectionDescription>
          </SectionHeader>
          <div>
            <StatusBadge variant={final ? "success" : "warning"}>
              {final ? "Final" : "Provisional"}
            </StatusBadge>
          </div>
        </SectionHeaderRow>
        <PropertyList>
          {report.workspace.name ? (
            <Property>
              <PropertyLabel>Workspace</PropertyLabel>
              <PropertyValue className="font-sans">
                {report.workspace.name}
              </PropertyValue>
            </Property>
          ) : null}
          <Property>
            <PropertyLabel>Generated</PropertyLabel>
            <PropertyValue>
              {formatSlaInstant(report.generatedAt, timeZone)}
            </PropertyValue>
          </Property>
          <Property>
            <PropertyLabel>Sealed</PropertyLabel>
            <PropertyValue>
              {report.sealedAt
                ? formatSlaInstant(report.sealedAt, timeZone)
                : "Not sealed yet"}
            </PropertyValue>
          </Property>
        </PropertyList>
        {report.provisional ? (
          <Note color="warning" size="sm">
            <ProvisionalText
              provisional={report.provisional}
              timeZone={timeZone}
            />
          </Note>
        ) : null}
      </Section>

      {report.empty ? (
        <EmptyStateContainer>
          <EmptyStateMedia>
            <FileText />
          </EmptyStateMedia>
          <EmptyStateTitle>Nothing to report for this month</EmptyStateTitle>
          <EmptyStateDescription>
            {report.monitors.length === 0
              ? "No monitor was under this reporting in that month."
              : "No checks were measured for these monitors in that month, or its checks are no longer kept and it was never sealed."}
          </EmptyStateDescription>
        </EmptyStateContainer>
      ) : (
        <>
          <Section id="commitment">
            <SectionHeader>
              <SectionTitle>Commitment</SectionTitle>
              <SectionDescription>
                {final
                  ? "The terms the month was sealed with."
                  : "The terms that apply to the month."}
              </SectionDescription>
            </SectionHeader>
            <PropertyList>
              <Property>
                <PropertyLabel>Target</PropertyLabel>
                <PropertyValue className="flex-wrap gap-x-2 gap-y-0">
                  {formatSlaTarget(terms.target)}% monthly uptime per monitor
                  <span className="text-muted-foreground">
                    {allowedDowntime(terms.target)} down in a 30-day month
                  </span>
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Slow checks</PropertyLabel>
                <PropertyValue className="font-sans">
                  {terms.strict ? "Count as down" : "Count as up"}
                </PropertyValue>
              </Property>
              <Property>
                <PropertyLabel>Credits</PropertyLabel>
                <PropertyValue className="font-sans whitespace-normal">
                  {terms.creditSchedule
                    ? `${terms.creditSchedule.creditPct}% of monthly fees for each started ${terms.creditSchedule.stepPct}% below target, up to ${terms.creditSchedule.capPct}%`
                    : "No credit schedule"}
                </PropertyValue>
              </Property>
            </PropertyList>
          </Section>

          <Section id="result">
            <SectionHeader>
              <SectionTitle>Result</SectionTitle>
              <SectionDescription>
                {judged === 0
                  ? "No monitor has a judgement for this month."
                  : `${met} of ${judged} ${judged === 1 ? "monitor" : "monitors"} met the target${final ? "" : " so far"}.`}{" "}
                Each monitor is judged on its own; a combined figure for the
                reporting as one product is not computed yet.
                {terms.creditSchedule
                  ? ` Credits are per monitor, a computed share of monthly fees, not a billing action${final ? "" : ", provisional until the month seals"}.`
                  : null}
              </SectionDescription>
            </SectionHeader>
            <DataTable
              columns={resultColumns}
              data={report.monitors}
              defaultPagination={{
                pageIndex: 0,
                pageSize: report.monitors.length || 1,
              }}
            />
          </Section>

          <Section id="components">
            <SectionHeader>
              <SectionTitle>Per component</SectionTitle>
              <SectionDescription>
                Where each monitor's month went. Down counts against the target;
                slow counts{" "}
                {terms.strict ? "as down, and is part of down" : "as up"};
                excused and unmeasured time count neither way.
              </SectionDescription>
            </SectionHeader>
            <DataTable
              columns={componentColumns}
              data={report.monitors}
              defaultPagination={{
                pageIndex: 0,
                pageSize: report.monitors.length || 1,
              }}
            />
          </Section>

          <Section id="downtime">
            <SectionHeader>
              <SectionTitle>Downtime</SectionTitle>
              <SectionDescription>
                Down and slow stretches that counted, longest first.
              </SectionDescription>
            </SectionHeader>
            <DataTable
              columns={downtimeColumns}
              data={report.downtime.items}
              defaultPagination={{
                pageIndex: 0,
                pageSize: report.downtime.items.length || 1,
              }}
              emptyState={
                <DataTableEmpty>
                  <EmptyStateTitle>No downtime</EmptyStateTitle>
                  <EmptyStateDescription>
                    Every measured check was up.
                  </EmptyStateDescription>
                </DataTableEmpty>
              }
            />
            {report.downtime.more > 0 ? (
              <p className="text-muted-foreground text-sm">
                And {report.downtime.more} more. The CSV export lists every
                stretch.
              </p>
            ) : null}
          </Section>

          <Section id="excused-downtime">
            <SectionHeader>
              <SectionTitle>Excused downtime</SectionTitle>
              <SectionDescription>
                Windows left out of both sides of the month for every monitor,
                with the reason given.
              </SectionDescription>
            </SectionHeader>
            <DataTable
              columns={excusedColumns}
              data={report.excusedWindows}
              defaultPagination={{
                pageIndex: 0,
                pageSize: report.excusedWindows.length || 1,
              }}
              emptyState={
                <DataTableEmpty>
                  <EmptyStateTitle>No excused downtime</EmptyStateTitle>
                  <EmptyStateDescription>
                    Every check counted toward the month.
                  </EmptyStateDescription>
                </DataTableEmpty>
              }
            />
          </Section>

          <Section id="maintenance">
            <SectionHeader>
              <SectionTitle>Maintenance</SectionTitle>
              <SectionDescription>
                Status page maintenances on these monitors. Where checks pause,
                the time is unmeasured; where they continue, it counts unless an
                excused window covers it.
              </SectionDescription>
            </SectionHeader>
            <DataTable
              columns={maintenanceColumns}
              data={report.maintenances}
              defaultPagination={{
                pageIndex: 0,
                pageSize: report.maintenances.length || 1,
              }}
              emptyState={
                <DataTableEmpty>
                  <EmptyStateTitle>No maintenance</EmptyStateTitle>
                  <EmptyStateDescription>
                    No status page maintenance touched these monitors.
                  </EmptyStateDescription>
                </DataTableEmpty>
              }
            />
          </Section>

          <Section id="rolling-count">
            <SectionHeader>
              <SectionTitle>Months with a miss</SectionTitle>
            </SectionHeader>
            <p className="text-sm">
              <span className="font-mono font-medium tabular-nums">
                {report.missed.months}
              </span>{" "}
              of the {report.missed.of} months up to {monthLong(report.month)}{" "}
              had a monitor miss its target
              {report.missed.previews > 0
                ? `, ${report.missed.previews} of them not sealed yet`
                : null}
              .
            </p>
          </Section>

          <Section id="method">
            <SectionHeader>
              <SectionTitle>Method</SectionTitle>
            </SectionHeader>
            <p className="text-muted-foreground text-sm">{report.method}</p>
          </Section>
        </>
      )}
      <p className="text-muted-foreground text-xs">Generated by openstatus.</p>
    </>
  );
}

function ProvisionalText({
  provisional,
  timeZone,
}: {
  provisional: NonNullable<Report["provisional"]>;
  timeZone: string;
}) {
  if (provisional.reason === "pending" && provisional.expectedAt) {
    return (
      <span>
        Provisional: the figures can still change. The month is expected to seal
        around {formatSlaInstant(provisional.expectedAt, timeZone)}.
      </span>
    );
  }
  if (provisional.reason === "overdue") {
    return (
      <span>
        Provisional: the figures can still change. Sealing is overdue, usually
        because the month's checks could not be loaded yet; it is retried daily.
      </span>
    );
  }
  return (
    <span>
      Provisional: this month was not sealed for every monitor and no longer can
      be, so its figures stay as shown.
    </span>
  );
}
