"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";

import { Link } from "@/components/common/link";
import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetDescription,
  DataTableSheetFooter,
  DataTableSheetHeader,
  DataTableSheetTitle,
} from "@/components/data-table/data-table-sheet";
import type { ExcusedWindowPrefill } from "@/components/forms/monitor-reporting/dialog-excused-window";
import {
  MetricCard,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import {
  formatBudgetLeft,
  formatExcusedWindow,
  formatPendingTerms,
  formatSlaCoverage,
  formatSlaDuration,
  formatSlaMonth,
  formatSlaTarget,
  type SlaTreatment,
  slaTreatmentLabels,
  slaTreatmentTotals,
} from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

import { SlaBudgetBar } from "./sla-budget";
import { SlaBurndown } from "./sla-burndown";

type MonitorMonth = RouterOutputs["monitorReporting"]["monitorMonth"];
type Episode = NonNullable<MonitorMonth["episodes"]>[number];

const EPISODES_SHOWN = 50;

const kindLabels: Record<Episode["kind"], string> = {
  error: "Down",
  degraded: "Slow",
  unmeasured: "No checks",
};

// the row already names the kind, so the treatment reads without it
const rowTreatmentLabels: Record<SlaTreatment, string> = {
  counted: "counted",
  lenient: "counted as up",
  excused: "excused",
  unmeasured: "not measured",
};

const treatmentText: Record<SlaTreatment, string> = {
  counted: "text-destructive",
  lenient: "text-muted-foreground",
  excused: "text-muted-foreground",
  unmeasured: "text-muted-foreground",
};

const monthStateNote: Record<MonitorMonth["state"], string> = {
  live: "",
  sealed: " · sealed",
  preview: " · preview, not sealed yet",
  none: "",
};

const unavailableText: Record<
  NonNullable<MonitorMonth["episodesUnavailable"]>,
  string
> = {
  runs: "This month was judged by run count, so it keeps no record of what used the budget.",
  failed:
    "The checks of this month could not be loaded. Try again in a minute.",
  expired:
    "This month was never sealed and its checks are no longer kept, so it has no judgement.",
};

/** One monitor's month under the reporting, the running one by default. */
export function SlaMonitorMonthSheet({
  policy,
  monitor,
  month,
  onClose,
  onExcuse,
}: {
  policy: { id: number; name: string; timeZone: string };
  monitor: { id: number; name: string } | null;
  /** YYYY-MM; null for the running month */
  month?: string | null;
  onClose: () => void;
  /** absent when the viewer cannot add excused windows */
  onExcuse?: (prefill: ExcusedWindowPrefill | null) => void;
}) {
  // keeps the body while the sheet slides out
  const [shown, setShown] = useState(monitor ? { monitor, month } : null);
  if (
    monitor &&
    (monitor.id !== shown?.monitor.id || (month ?? null) !== shown.month)
  ) {
    setShown({ monitor, month: month ?? null });
  }
  return (
    <DataTableSheet
      open={monitor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DataTableSheetContent className="flex flex-col sm:max-w-md">
        {shown ? (
          <SheetBody
            policy={policy}
            monitor={shown.monitor}
            month={shown.month ?? null}
            onExcuse={onExcuse}
          />
        ) : null}
      </DataTableSheetContent>
    </DataTableSheet>
  );
}

function SheetBody({
  policy,
  monitor,
  month,
  onExcuse,
}: {
  policy: { id: number; name: string; timeZone: string };
  monitor: { id: number; name: string };
  month: string | null;
  onExcuse?: (prefill: ExcusedWindowPrefill | null) => void;
}) {
  const trpc = useTRPC();
  const { data: covering } = useQuery(
    trpc.monitorReporting.listForMonitor.queryOptions({
      monitorId: monitor.id,
    }),
  );
  const alsoCoveredBy = (covering ?? []).filter((p) => p.id !== policy.id);
  const { data, isError } = useQuery(
    trpc.monitorReporting.monitorMonth.queryOptions({
      id: policy.id,
      monitorId: monitor.id,
      ...(month ? { month } : {}),
    }),
  );
  const latestCounted = data?.episodes?.find((e) => e.treatment === "counted");
  // windows lock once their month is sealed or older than the previous one
  const canExcuse = data
    ? data.state === "live" || data.state === "preview"
    : month === null;

  return (
    <>
      <DataTableSheetHeader className="px-4">
        <DataTableSheetTitle className="truncate">
          {monitor.name}
        </DataTableSheetTitle>
        <DataTableSheetDescription>
          {data
            ? `${formatSlaMonth(data.month, { year: true })}${data.state === "live" ? " so far" : ""} in ${data.timeZone}${monthStateNote[data.state]}`
            : month
              ? `${formatSlaMonth(`${month}-01`, { year: true })} in ${policy.timeZone}`
              : `This month so far in ${policy.timeZone}`}
          {data?.terms
            ? ` · ${formatSlaTarget(data.terms.target)}% target`
            : null}
        </DataTableSheetDescription>
      </DataTableSheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
        {isError ? (
          <p className="text-destructive text-sm">
            This month could not be loaded. Try again in a minute.
          </p>
        ) : !data ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-2" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <MonthDetail month={data} />
        )}
        {alsoCoveredBy.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Also covered by</h3>
            <ul className="grid gap-1.5 text-sm">
              {alsoCoveredBy.map((p) => (
                <li key={p.id} className="flex min-w-0 items-baseline gap-2">
                  <Link
                    href={`/reportings/monitors/${p.id}?monitor=${monitor.id}`}
                    className="truncate"
                  >
                    {p.name}
                  </Link>
                  <span className="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
                    {formatSlaTarget(p.liveTerms.target)}%
                    {p.pendingTerms ? (
                      <span> {formatPendingTerms(p.pendingTerms)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <DataTableSheetFooter className="flex-row justify-end gap-2 px-4">
        <Button variant="outline" size="sm" asChild>
          <NextLink href={`/monitors/${monitor.id}/overview`}>
            Open monitor
          </NextLink>
        </Button>
        {onExcuse && canExcuse ? (
          <Button
            size="sm"
            onClick={() =>
              onExcuse(
                latestCounted
                  ? {
                      from: new Date(latestCounted.startedAt),
                      to: new Date(latestCounted.endedAt),
                    }
                  : null,
              )
            }
          >
            Excuse a window
          </Button>
        ) : null}
      </DataTableSheetFooter>
    </>
  );
}

function MonthDetail({ month }: { month: MonitorMonth }) {
  const { budget, episodes } = month;
  const totals = episodes ? slaTreatmentTotals(episodes) : [];
  return (
    <>
      <MetricCardGroup className="grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2">
        <MetricCard>
          <MetricCardHeader>
            <MetricCardTitle className="uppercase">
              {month.state === "live" ? "So far" : "Uptime"}
            </MetricCardTitle>
          </MetricCardHeader>
          <MetricCardValue
            className={cn(
              "font-mono tabular-nums",
              month.uptime !== null &&
                (month.met === false
                  ? "text-destructive"
                  : month.state === "live"
                    ? "text-info"
                    : "text-success"),
            )}
          >
            {month.uptime === null ? "—" : `${formatSlaUptime(month.uptime)}%`}
          </MetricCardValue>
          <p className="text-muted-foreground text-xs">
            {month.coverage === null
              ? month.method === "runs"
                ? "judged by run count"
                : month.episodesUnavailable === "failed"
                  ? "checks could not be loaded"
                  : "nothing measured yet"
              : `${formatSlaCoverage(month.coverage)}% of the time measured`}
          </p>
        </MetricCard>
        <MetricCard>
          <MetricCardHeader>
            <MetricCardTitle className="uppercase">Budget left</MetricCardTitle>
          </MetricCardHeader>
          <MetricCardValue
            className={cn(
              "font-mono tabular-nums",
              budget && budget.leftMs < 0 && "text-destructive",
            )}
          >
            {budget
              ? budget.leftMs < 0
                ? `−${formatSlaDuration(budget.leftMs)}`
                : formatSlaDuration(budget.leftMs)
              : "—"}
          </MetricCardValue>
          <p className="text-muted-foreground text-xs">
            {budget
              ? `of ${formatSlaDuration(budget.budgetMs)} ${month.state === "live" ? "this month" : "that month"}`
              : "no budget for this month"}
          </p>
        </MetricCard>
      </MetricCardGroup>

      {budget ? (
        <section className="grid gap-2">
          <SlaBudgetBar
            burnedMs={budget.burnedMs}
            budgetMs={budget.budgetMs}
            paceMs={budget.paceMs}
          />
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground font-mono">
              {formatSlaDuration(budget.burnedMs)}
            </span>{" "}
            burned, {formatBudgetLeft(budget.leftMs)}
            {budget.paceMs !== null && month.state === "live" ? (
              <>
                {" "}
                · on pace for{" "}
                <span
                  className={cn(
                    "font-mono",
                    budget.paceMs > budget.budgetMs
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  {formatSlaDuration(budget.paceMs)}
                </span>{" "}
                by month end
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      {month.credit || month.creditSchedule ? (
        <SlaCreditRow month={month} />
      ) : null}

      <SlaBurndown month={month} />

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">
          What used the budget{" "}
          {episodes ? (
            <span className="text-muted-foreground font-mono font-normal">
              {episodes.length}
            </span>
          ) : null}
        </h3>
        {totals.length > 0 ? (
          <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {totals.map((t) => (
              <span key={t.treatment}>
                {slaTreatmentLabels[t.treatment]}{" "}
                <span className={cn("font-mono", treatmentText[t.treatment])}>
                  {formatSlaDuration(t.ms)}
                </span>
              </span>
            ))}
          </p>
        ) : null}
        {month.episodesUnavailable ? (
          <p className="text-muted-foreground text-sm">
            {unavailableText[month.episodesUnavailable]}
          </p>
        ) : episodes && episodes.length > 0 ? (
          <ol className="divide-y text-sm">
            {episodes.slice(0, EPISODES_SHOWN).map((e) => (
              <EpisodeRow
                key={`${e.startedAt}-${e.treatment}`}
                episode={e}
                timeZone={month.timeZone}
              />
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">
            {month.state === "live"
              ? "Nothing yet: every check this month was up."
              : "Nothing: every check that month was up."}
          </p>
        )}
        {episodes && episodes.length > EPISODES_SHOWN ? (
          <p className="text-muted-foreground text-xs">
            And {episodes.length - EPISODES_SHOWN} older.
          </p>
        ) : null}
        {month.countedMaintenances.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Checks kept running during{" "}
            {month.countedMaintenances.map((m) => m.title).join(", ")}, and no
            excused window covers{" "}
            {month.countedMaintenances.length === 1 ? "it" : "them"}, so{" "}
            {month.countedMaintenances.length === 1 ? "its" : "their"} down time
            counts.
          </p>
        ) : null}
      </section>
    </>
  );
}

function EpisodeRow({
  episode: e,
  timeZone,
}: {
  episode: Episode;
  timeZone: string;
}) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>
          {kindLabels[e.kind]}
          {" · "}
          <span className={treatmentText[e.treatment]}>
            {rowTreatmentLabels[e.treatment]}
          </span>
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs">
          <time dateTime={new Date(e.startedAt).toISOString()}>
            {formatExcusedWindow(
              new Date(e.startedAt),
              new Date(e.endedAt),
              timeZone,
            )}
          </time>
          {e.maintenance ? ` · ${e.maintenance.title}` : null}
        </span>
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {formatSlaDuration(e.weightedMs)}
      </span>
    </li>
  );
}

function SlaCreditRow({ month }: { month: MonitorMonth }) {
  const { credit } = month;
  const provisional = month.state === "live" || month.state === "preview";
  return (
    <section className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">
          Service credit
          {provisional ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · provisional
            </span>
          ) : null}
        </h3>
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            credit && credit.pct > 0 && "text-destructive",
          )}
        >
          {credit ? `${credit.pct}% of fees` : "—"}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {credit === null
          ? "No judgement, so no credit."
          : credit.steps === 0
            ? "Target met, nothing owed."
            : `${credit.steps} started ${credit.steps === 1 ? "step" : "steps"} below target`}
        {credit && month.coverage !== null
          ? ` · ${formatSlaCoverage(month.coverage)}% of the time measured`
          : null}
        {provisional
          ? " · fixed when the month seals."
          : month.state === "sealed"
            ? " · stored when the month sealed."
            : "."}{" "}
        A computed figure, not a billing action.
      </p>
    </section>
  );
}
