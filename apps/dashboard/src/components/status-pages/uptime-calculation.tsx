"use client";

import { impactUptimeWeight } from "@openstatus/db/src/schema/page_components/constants";
import { Next } from "@openstatus/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";
import type React from "react";

import { Link } from "@/components/common/link";
import {
  UPTIME_COLUMNS,
  UPTIME_DOCS_URL,
  UPTIME_MATRIX,
  UPTIME_MODES,
  type UptimeCell,
  type UptimeMode,
  type UptimeRow,
} from "@/data/uptime-calculation.client";

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

const weightOf = (cell: UptimeCell) => (typeof cell === "number" ? cell : 0);

function cellLabel(cell: UptimeCell, section: "monitors" | "reports") {
  if (cell === null) return "—";
  if (cell === "up") return "Up";
  if (cell === "ignored") return "Not counted";
  return section === "monitors" && cell === 1 ? "Down" : pct(cell);
}

function cellColor(cell: UptimeCell) {
  if (cell === "up") return "text-success";
  if (typeof cell !== "number" || cell === 0) return "text-muted-foreground";
  return cell === 1 ? "text-destructive" : "text-warning";
}

function Cell({
  cell,
  before,
  section,
}: {
  cell: UptimeCell;
  before: UptimeCell;
  section: "monitors" | "reports";
}) {
  const label = (
    <span className={cn("font-mono", cellColor(cell))}>
      {cellLabel(cell, section)}
    </span>
  );
  // a change in wording alone (Up vs Not counted) does not move the number
  if (cell === null || weightOf(cell) === weightOf(before)) return label;
  return (
    <span className="-mr-1.5 inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5">
      <s className="text-muted-foreground font-mono">
        {cellLabel(before, section)}
      </s>
      <Next aria-label="becomes" className="text-muted-foreground size-3" />
      {label}
    </span>
  );
}

function MatrixTable({
  title,
  section,
  rows,
  before,
}: {
  title: string;
  section: "monitors" | "reports";
  rows: UptimeRow[];
  before: UptimeRow[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-foreground">{title}</TableHead>
            {UPTIME_COLUMNS.map((column) => (
              <TableHead
                key={column}
                className="text-foreground text-right sm:w-48"
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row.key} className="hover:bg-transparent">
              <TableCell className="whitespace-normal">
                {row.label}
                {row.hint ? (
                  <span className="text-muted-foreground hidden sm:inline">
                    {" · "}
                    {row.hint}
                  </span>
                ) : null}
              </TableCell>
              {row.cells.map((cell, column) => (
                <TableCell key={UPTIME_COLUMNS[column]} className="text-right">
                  <Cell
                    cell={cell}
                    before={before[i].cells[column]}
                    section={section}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * What counts against uptime under `mode`, per component kind. Cells that
 * count differently than under `configured` show the change.
 */
export function UptimeCalculation({
  mode,
  configured,
  onModeChange,
  children,
  className,
}: {
  mode: UptimeMode;
  configured: UptimeMode;
  onModeChange: (mode: UptimeMode) => void;
  /** shown under the tables, e.g. what switching would do to the page's uptime */
  children?: React.ReactNode;
  className?: string;
}) {
  const current = UPTIME_MATRIX[mode];
  const before = UPTIME_MATRIX[configured];
  return (
    <div className={cn("grid gap-3 text-sm", className)}>
      <Tabs
        value={mode}
        onValueChange={(next) => {
          const found = UPTIME_MODES.find((m) => m.value === next);
          if (found) onModeChange(found.value);
        }}
        className="overflow-x-auto"
      >
        <TabsList>
          {UPTIME_MODES.map((m) => (
            <TabsTrigger key={m.value} value={m.value}>
              {m.label}
              {m.value === configured ? (
                <span className="text-muted-foreground font-mono text-xs font-normal">
                  In use
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-muted-foreground">
        {UPTIME_MODES.find((m) => m.value === mode)?.meaning}
      </p>
      <MatrixTable
        title="Monitor data"
        section="monitors"
        rows={current.monitors}
        before={before.monitors}
      />
      <MatrixTable
        title="Status reports"
        section="reports"
        rows={current.reports}
        before={before.reports}
      />
      <p className="text-muted-foreground">
        {mode === "manual"
          ? "Heartbeat monitors are counted by time, and only status reports count against them."
          : "Heartbeat monitors are counted by time: outages and reports both count against them, and an outage and a report over the same time count once."}
        {current.notes.map((note) => ` ${note}`)} Excuse a resolved outage in{" "}
        <Link href={`${UPTIME_DOCS_URL}#excused-outages`}>
          Monitors &gt; Outages
        </Link>
        .
      </p>
      {children}
    </div>
  );
}

/** Impact picker hint: what each impact does to the page's uptime. */
export function ImpactUptimeHint() {
  return (
    <>
      Under Time per status a major outage counts{" "}
      {pct(impactUptimeWeight("major_outage"))} of the report's time as
      downtime, a partial outage {pct(impactUptimeWeight("partial_outage"))},
      degraded performance {pct(impactUptimeWeight("degraded_performance"))}.{" "}
      <Link href={`${UPTIME_DOCS_URL}#status-report-impact`}>Learn more</Link>
    </>
  );
}
