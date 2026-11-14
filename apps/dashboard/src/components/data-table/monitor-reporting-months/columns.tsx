"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { cn } from "@openstatus/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

import {
  formatSlaCoverage,
  formatSlaDuration,
  formatSlaMonth,
  formatSlaTarget,
} from "@/data/reportings.client";

type PolicyMonitor =
  RouterOutputs["monitorReporting"]["get"]["monitors"][number];
type PolicyMonth = PolicyMonitor["months"][number];

function runsNote(m: PolicyMonth): string | null {
  if (!m.counts) return null;
  const excused = m.excused
    ? m.excused.ok + m.excused.degraded + m.excused.error
    : 0;
  const total = m.counts.ok + m.counts.degraded + m.counts.error;
  return excused > 0 ? `${total} runs, ${excused} excused` : `${total} runs`;
}

/** How the month was judged: run count (legacy seals) or time, with coverage. */
function basisNote(m: PolicyMonth): string | null {
  if (m.method === "runs") {
    const runs = runsNote(m);
    return runs ? `judged by run count, ${runs}` : "judged by run count";
  }
  if (m.method === "time") {
    const parts = ["judged on time"];
    if (m.coverage !== null) {
      parts.push(`${formatSlaCoverage(m.coverage)}% of the time measured`);
    }
    if (m.downMs !== null && m.downMs > 0) {
      parts.push(`${formatSlaDuration(m.downMs)} down`);
    }
    return parts.join(", ");
  }
  return null;
}

function monthTitle(m: PolicyMonth): string {
  const label = `${formatSlaMonth(m.month, { year: true })} (${m.timeZone})`;
  const basis = basisNote(m);
  const suffix = basis ? ` (${basis})` : "";
  if (m.uptime === null && m.counts !== null) {
    return `${label}: every run excused, no judgement`;
  }
  if (m.uptime === null) {
    if (m.state === "live") return `${label}: no checks yet, provisional`;
    return m.state === "none"
      ? `${label}: no data`
      : `${label}: no checks, no judgement`;
  }
  if (m.state === "live") {
    return `${label}: ${formatSlaUptime(m.uptime)}% so far, ${m.met ? "on target" : "miss in progress"}, provisional${suffix}`;
  }
  const result = `${label}: ${formatSlaUptime(m.uptime)}%, ${m.met ? "met" : "missed"}`;
  if (m.sealed) {
    const at = new Date(m.sealed.at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    const slow = m.sealed.strict
      ? "slow counted as down"
      : "slow counted as up";
    return `${result}, sealed ${at} against ${formatSlaTarget(m.sealed.target)}%, ${slow}${suffix}`;
  }
  const terms = m.terms ? ` against ${formatSlaTarget(m.terms.target)}%` : "";
  return `${result}, preview until sealed${terms}${suffix}`;
}

function MonthCell({
  month,
  onSelect,
}: {
  month: PolicyMonth;
  onSelect?: () => void;
}) {
  const title = monthTitle(month);
  const Comp = onSelect ? "button" : "span";
  return (
    <Comp
      type={onSelect ? "button" : undefined}
      title={title}
      onClick={onSelect}
      className={cn(
        "block w-full rounded-md border px-1 py-1.5 text-center font-mono text-xs tabular-nums",
        onSelect &&
          "focus-visible:ring-ring/50 cursor-pointer outline-none hover:brightness-125 focus-visible:ring-[3px]",
        month.state === "preview" && "border-dashed",
        month.met === true && "border-success/40 text-success",
        month.met === false && "border-destructive/40 text-destructive",
        month.state === "live" && "bg-info/10 border-transparent",
        month.state === "live" && month.met === true && "text-info",
        month.state === "sealed" &&
          month.met === true &&
          "bg-success/10 border-transparent",
        month.state === "sealed" &&
          month.met === false &&
          "bg-destructive/10 border-transparent",
        month.met === null && "text-muted-foreground/50 border-transparent",
      )}
    >
      <span aria-hidden="true">
        {month.uptime === null ? "—" : formatSlaUptime(month.uptime)}
      </span>
      <span className="sr-only">{title}</span>
    </Comp>
  );
}

/** One column per month, oldest first, between the monitor and its miss count. */
export function getColumns(
  months: string[],
  {
    timeZone,
    onSelect,
  }: {
    timeZone: string;
    /** `month` as YYYY-MM, null for the running month */
    onSelect?: (monitorId: number, month?: string | null) => void;
  },
): ColumnDef<PolicyMonitor>[] {
  const current = months.at(-1);
  return [
    {
      accessorKey: "name",
      header: "Monitor",
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium">{row.original.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {row.original.url}
          </span>
        </div>
      ),
      meta: { cellClassName: "max-w-56 min-w-44" },
    },
    ...months.map((month, i): ColumnDef<PolicyMonitor> => ({
      id: month,
      header: () => (
        <span
          title={
            month === current
              ? `${formatSlaMonth(month, { year: true })} in ${timeZone}, so far (provisional)`
              : `${formatSlaMonth(month, { year: true })} in ${timeZone}`
          }
          className={cn(
            "flex flex-col leading-tight",
            month === current && "text-info",
          )}
        >
          {formatSlaMonth(month)}
          <span className="text-muted-foreground text-[10px]">
            {i === 0 || month.slice(5, 7) === "01" ? month.slice(0, 4) : null}
          </span>
        </span>
      ),
      cell: ({ row }) => {
        const cell = row.original.months[i];
        return (
          <MonthCell
            month={cell}
            onSelect={
              onSelect && cell.state !== "none"
                ? () =>
                    onSelect(
                      row.original.id,
                      month === current ? null : month.slice(0, 7),
                    )
                : undefined
            }
          />
        );
      },
      meta: {
        headerClassName: "px-1 text-center font-mono text-xs",
        cellClassName: "p-1",
      },
    })),
    {
      id: "missed",
      accessorFn: (row) => row.missed.months,
      header: () => <span title="Months missed in the last 12">Missed</span>,
      cell: ({ row }) => (
        <span
          className={cn(
            "block text-right font-mono tabular-nums",
            row.original.missed.months > 0
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {row.original.missed.months}
        </span>
      ),
      meta: { headerClassName: "text-right" },
    },
  ];
}
