"use client";

import { TZDate } from "@date-fns/tz";
import type { RouterOutputs } from "@openstatus/api";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@openstatus/ui/components/ui/chart";
import { cn } from "@openstatus/ui/lib/utils";
import { addDays } from "date-fns";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { formatSlaDuration } from "@/data/reportings.client";

type MonitorMonth = RouterOutputs["monitorReporting"]["monitorMonth"];

type Point = {
  day: number;
  left?: number | null;
  ideal?: number;
  projected?: number | null;
  /** sqrt-scaled share of the worst day, stacked */
  down?: number;
  slow?: number;
};

type BurnDay = {
  day: number;
  start: number;
  end: number;
  downMs: number;
  slowMs: number;
  leftMs: number;
  elapsed: boolean;
};

const Y_AXIS_WIDTH = 36;
const RIGHT_MARGIN = 8;

const chartConfig = {
  left: { label: "Left", color: "var(--color-info)" },
  ideal: { label: "Even burn", color: "var(--color-muted-foreground)" },
  projected: { label: "Projected", color: "var(--color-info)" },
  down: { label: "Down", color: "var(--color-destructive)" },
  slow: { label: "Slow", color: "var(--color-warning)" },
} satisfies ChartConfig;

/** Counted down time per calendar day of the month in its time zone. */
function burnDays(month: MonitorMonth, budgetMs: number, cutoff: number) {
  const days: BurnDay[] = [];
  let start = new TZDate(month.range.start, month.timeZone);
  while (start.getTime() < month.range.end) {
    const next = addDays(start, 1);
    days.push({
      day: days.length + 1,
      start: start.getTime(),
      end: Math.min(next.getTime(), month.range.end),
      downMs: 0,
      slowMs: 0,
      leftMs: budgetMs,
      elapsed: start.getTime() < cutoff,
    });
    start = next;
  }
  const counted = (month.episodes ?? [])
    .filter((e) => e.treatment === "counted" && e.kind !== "unmeasured")
    .sort((a, b) => a.startedAt - b.startedAt);
  for (const e of counted) {
    const span = Math.max(e.endedAt - e.startedAt, 1);
    for (const d of days) {
      const overlap =
        Math.min(d.end, e.endedAt) - Math.max(d.start, e.startedAt);
      if (overlap <= 0) continue;
      // weightedMs can differ from wall time; spread it by the overlap
      const ms = (e.weightedMs * overlap) / span;
      if (e.kind === "degraded") d.slowMs += ms;
      else d.downMs += ms;
    }
  }
  let burned = 0;
  let exhaustedAt: number | null = null;
  for (const e of counted) {
    if (exhaustedAt === null && burned + e.weightedMs > budgetMs) {
      const share = (budgetMs - burned) / e.weightedMs;
      exhaustedAt = e.startedAt + (e.endedAt - e.startedAt) * share;
    }
    burned += e.weightedMs;
  }
  let total = 0;
  for (const d of days) {
    total += d.downMs + d.slowMs;
    d.leftMs = budgetMs - total;
  }
  return { days, exhaustedAt };
}

function shortTick(v: number) {
  if (v === 0) return "0";
  const m = Math.round(Math.abs(v) / 60_000);
  const label =
    m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ""}` : `${m}m`;
  return v < 0 ? `−${label}` : label;
}

/** When the month's down-time budget went: budget left per day over the day's down and slow time. */
export function SlaBurndown({ month }: { month: MonitorMonth }) {
  const [now] = useState(Date.now);
  const { budget } = month;
  if (!budget || !month.episodes) return null;
  const live = month.state === "live";
  const cutoff = live ? Math.min(now, month.range.end) : month.range.end;
  const { budgetMs } = budget;
  const { days, exhaustedAt } = burnDays(month, budgetMs, cutoff);
  const dayCount = days.length;
  const shortDate = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: month.timeZone,
    });

  const projectedEnd =
    live && budget.paceMs !== null ? budgetMs - budget.paceMs : null;
  const peak = Math.max(...days.map((d) => d.downMs + d.slowMs), 0);
  // sqrt: one long outage would otherwise flatten every other day
  const barHeight = (ms: number) => (peak > 0 ? Math.sqrt(ms / peak) : 0);

  // one row per day: a single point under the cursor keeps the tooltip steady
  const points: Point[] = days.map((d) => {
    const total = d.downMs + d.slowMs;
    const h = barHeight(total);
    const running = live && d.start < cutoff && d.end > cutoff;
    return {
      day: d.day,
      // budget left at the end of the day; the running day holds the burn so far
      left: d.start < cutoff ? d.leftMs : null,
      ideal: budgetMs * (1 - (d.day - 0.5) / dayCount),
      projected: running
        ? d.leftMs
        : live && d.day === dayCount
          ? projectedEnd
          : null,
      down: total > 0 ? (h * d.downMs) / total : undefined,
      slow: total > 0 ? (h * d.slowMs) / total : undefined,
    };
  });

  const lowest = Math.min(
    0,
    ...points.map((p) => p.left ?? 0),
    projectedEnd ?? 0,
  );
  const yMin = lowest < 0 ? lowest * 1.15 : 0;
  const drawn = points.flatMap((p) => (p.left == null ? [] : [p.left]));
  const lowestLeft = Math.min(...drawn, budgetMs);
  const highestLeft = Math.max(...drawn, 0);
  // the stroke gradient spans the line's own bbox, highest to lowest point
  const zeroOffset =
    lowestLeft < 0 ? highestLeft / (highestLeft - lowestLeft) : 1;
  const exhaustedDay =
    exhaustedAt === null
      ? null
      : (days.find((d) => exhaustedAt < d.end)?.day ?? dayCount);
  const xTicks = [...new Set([1, 8, 15, 22, dayCount])];

  return (
    <section className="grid gap-1.5">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span>Budget left by day</span>
        <span className="flex items-center gap-3">
          <Legend swatch="bg-info h-0.5 w-3">Left</Legend>
          <Legend swatch="border-muted-foreground w-3 border-t border-dashed">
            Even burn
          </Legend>
          <Legend swatch="bg-destructive size-2">Down</Legend>
          <Legend swatch="bg-warning size-2">Slow</Legend>
        </span>
      </div>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[170px] w-full"
      >
        <ComposedChart
          data={points}
          barCategoryGap="30%"
          margin={{ top: 8, right: RIGHT_MARGIN, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient
              id="sla-burndown-stroke"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset={zeroOffset} stopColor="var(--color-left)" />
              <stop offset={zeroOffset} stopColor="var(--color-destructive)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          {yMin < 0 ? (
            <ReferenceArea
              y1={yMin}
              y2={0}
              fill="var(--color-destructive)"
              fillOpacity={0.08}
              stroke="none"
              ifOverflow="hidden"
            />
          ) : null}
          <XAxis
            dataKey="day"
            ticks={xTicks}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            fontSize={10}
            className="font-mono"
          />
          <YAxis
            type="number"
            domain={[yMin, budgetMs]}
            ticks={yMin < 0 ? [budgetMs, 0, lowest] : [budgetMs, 0]}
            tickFormatter={shortTick}
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_WIDTH}
            fontSize={10}
            className="font-mono"
          />
          {/* bars use the bottom ~30% of the plot: their max is 1, the axis runs to 3.3 */}
          <YAxis yAxisId="days" domain={[0, 3.3]} hide />
          <ReferenceLine y={0} stroke="var(--color-border)" />
          <ChartTooltip
            cursor={{ stroke: "var(--color-border)" }}
            content={({ active, label }) => {
              if (!active || typeof label !== "number") return null;
              const day = days[label - 1];
              if (!day) return null;
              return (
                <div className="bg-background grid min-w-36 gap-1 rounded-md border px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium">{shortDate(day.start)}</div>
                  {day.elapsed ? (
                    <>
                      <TooltipRow label="Down" dot="bg-destructive">
                        {formatSlaDuration(day.downMs)}
                      </TooltipRow>
                      <TooltipRow label="Slow" dot="bg-warning">
                        {formatSlaDuration(day.slowMs)}
                      </TooltipRow>
                      <TooltipRow
                        label={day.leftMs < 0 ? "Over" : "Left"}
                        className={cn(day.leftMs < 0 && "text-destructive")}
                      >
                        {formatSlaDuration(day.leftMs)}
                      </TooltipRow>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not yet</span>
                  )}
                </div>
              );
            }}
          />
          <Bar
            yAxisId="days"
            dataKey="down"
            stackId="day"
            fill="var(--color-down)"
            fillOpacity={0.85}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="days"
            dataKey="slow"
            stackId="day"
            fill="var(--color-slow)"
            fillOpacity={0.85}
            isAnimationActive={false}
          />
          {/* recharts only renders reference elements as direct children, no fragments */}
          <Line
            dataKey="ideal"
            type="linear"
            stroke="var(--color-ideal)"
            strokeDasharray="3 3"
            strokeWidth={1}
            strokeOpacity={0.6}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {live ? (
            <Line
              dataKey="projected"
              type="linear"
              stroke="var(--color-projected)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
          <Line
            dataKey="left"
            type="stepAfter"
            stroke={
              lowestLeft < 0 ? "url(#sla-burndown-stroke)" : "var(--color-left)"
            }
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          {exhaustedDay !== null && exhaustedAt !== null ? (
            <ReferenceLine
              x={exhaustedDay}
              stroke="var(--color-destructive)"
              strokeDasharray="2 2"
              label={{
                value: `Out ${shortDate(exhaustedAt)}`,
                position:
                  exhaustedDay > dayCount * 0.7
                    ? "insideTopRight"
                    : "insideTopLeft",
                fill: "var(--color-destructive)",
                fontSize: 10,
              }}
            />
          ) : null}
          {exhaustedDay !== null ? (
            <ReferenceDot
              x={exhaustedDay}
              y={0}
              r={3}
              fill="var(--color-destructive)"
              stroke="var(--color-background)"
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
    </section>
  );
}

function Legend({
  swatch,
  children,
}: {
  swatch: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block rounded-[1px]", swatch)} />
      {children}
    </span>
  );
}

function TooltipRow({
  label,
  dot,
  className,
  children,
}: {
  label: string;
  dot?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {dot ? <span className={cn("size-2 rounded-[2px]", dot)} /> : null}
        {label}
      </span>
      <span className={cn("font-mono tabular-nums", className)}>
        {children}
      </span>
    </div>
  );
}
