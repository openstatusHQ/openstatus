"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatSlaUptime } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { cn } from "@openstatus/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";

import { formatSlaMonth, formatSlaTarget } from "@/data/sla-policies.client";

type PolicyMonitor =
  RouterOutputs["monitorSlaPolicy"]["get"]["monitors"][number];
type PolicyMonth = PolicyMonitor["months"][number];

function monthTitle(m: PolicyMonth): string {
  const label = formatSlaMonth(m.month, { year: true });
  if (m.uptime === null && m.counts !== null) {
    return `${label}: every run excused, no judgement`;
  }
  if (m.uptime === null || m.counts === null) {
    if (m.state === "live") return `${label}: no checks yet, provisional`;
    return m.state === "none"
      ? `${label}: no data`
      : `${label}: no checks, no judgement`;
  }
  const excused = m.excused
    ? m.excused.ok + m.excused.degraded + m.excused.error
    : 0;
  const total = m.counts.ok + m.counts.degraded + m.counts.error;
  const runs =
    excused > 0 ? `${total} runs, ${excused} excused` : `${total} runs`;
  if (m.state === "live") {
    return `${label}: ${formatSlaUptime(m.uptime)}% so far, ${m.met ? "on target" : "miss in progress"}, provisional under today's terms (${runs})`;
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
    return `${result}, sealed ${at} against ${formatSlaTarget(m.sealed.target)}%, ${slow} (${runs})`;
  }
  return `${result}, preview under today's terms (${runs})`;
}

function MonthCell({ month }: { month: PolicyMonth }) {
  const title = monthTitle(month);
  return (
    <span
      title={title}
      className={cn(
        "block rounded-md border px-1 py-1.5 text-center font-mono text-xs tabular-nums",
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
    </span>
  );
}

/** One column per month, oldest first, between the monitor and its miss count. */
export function getColumns(months: string[]): ColumnDef<PolicyMonitor>[] {
  const current = months.at(-1);
  return [
    {
      accessorKey: "name",
      header: "Monitor",
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
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
              ? `${formatSlaMonth(month, { year: true })}, so far (provisional)`
              : formatSlaMonth(month, { year: true })
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
      cell: ({ row }) => <MonthCell month={row.original.months[i]} />,
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
