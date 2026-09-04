"use client";

import { formatRegionCode, getRegionInfo } from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstatus/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type CachedRegionChecker,
  getTimingPhases,
} from "../../../../../lib/checker/utils";

const chartConfig = {
  dns: { label: "DNS", color: "var(--chart-1)" },
  connection: { label: "Connection", color: "var(--chart-2)" },
  tls: { label: "TLS", color: "var(--chart-3)" },
  ttfb: { label: "TTFB", color: "var(--chart-4)" },
} satisfies ChartConfig;

const PHASES = Object.keys(chartConfig) as (keyof typeof chartConfig)[];

interface ChartProps {
  checks: CachedRegionChecker["checks"];
  desc: boolean;
  onToggleSort: () => void;
}

export function Chart({ checks, desc, onToggleSort }: ChartProps) {
  // `transfer` is left out: the checker stops its latency clock when the
  // response headers land, before the body is read. sorts on the stacked
  // total rather than `check.latency` — the two disagree whenever a checker
  // reports phases that don't add up to its round-trip
  const chartData = checks
    .map((check) => {
      const { dns, connection, tls, ttfb } = getTimingPhases(check.timing);
      return {
        region: check.region,
        total: dns + connection + tls + ttfb,
        dns,
        connection,
        tls,
        ttfb,
      };
    })
    .sort((a, b) => (desc ? b.total - a.total : a.total - b.total));

  return (
    <div className="border-border border">
      <div className="border-border flex flex-wrap items-center justify-between gap-x-2 border-b">
        <div className="p-4">
          latency by region{" "}
          <span className="text-muted-foreground">
            — {checks.length} regions
          </span>
        </div>
        <Button
          variant="ghost"
          className="h-auto! rounded-none p-4 text-base md:text-base"
          onClick={onToggleSort}
        >
          <span className="text-muted-foreground">sorted by</span> latency{" "}
          <span aria-hidden="true">{desc ? "↓" : "↑"}</span>
        </Button>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="min-w-2xl">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[420px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="region"
                tickLine={false}
                axisLine={false}
                interval={0}
                height={64}
                tickMargin={8}
                tick={<RegionTick />}
              />
              <YAxis
                mirror
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={44}
                tickCount={5}
                tickFormatter={(value) => `${value}ms`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="min-w-56 gap-3 rounded-none p-4 text-sm"
                    labelFormatter={(label) => {
                      const region = getRegionInfo(String(label));
                      return (
                        <div className="flex items-center justify-between gap-4">
                          <span>{region.location}</span>
                          <span className="text-muted-foreground">
                            {formatRegionCode(label)}
                          </span>
                        </div>
                      );
                    }}
                    formatter={(value, name, item, index) => (
                      <>
                        <div
                          className="size-3 shrink-0 bg-(--color-bg)"
                          style={
                            {
                              "--color-bg": `var(--color-${name})`,
                            } as React.CSSProperties
                          }
                        />
                        {chartConfig[name as keyof typeof chartConfig]?.label ||
                          name}
                        <TooltipValue value={Number(value)} />
                        {index === PHASES.length - 1 ? (
                          <div className="border-border text-foreground mt-1 flex basis-full items-center border-t pt-3 font-medium">
                            latency
                            <TooltipValue value={item.payload.total} />
                          </div>
                        ) : null}
                      </>
                    )}
                  />
                }
              />
              {PHASES.map((phase) => (
                <Bar
                  key={phase}
                  dataKey={phase}
                  stackId="a"
                  fill={`var(--color-${phase})`}
                  fillOpacity={0.6}
                  activeBar={{ fillOpacity: 1 }}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      </div>
      <div className="border-border flex flex-wrap items-center gap-4 border-t p-4">
        {PHASES.map((phase) => (
          <div key={phase} className="flex items-center gap-2">
            <div
              className="size-3 shrink-0"
              style={{ backgroundColor: chartConfig[phase].color }}
            />
            <span className="text-muted-foreground">
              {chartConfig[phase].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TooltipValue({ value }: { value: number }) {
  return (
    <div className="text-foreground ml-auto flex items-baseline gap-0.5 font-medium tabular-nums">
      {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}
      <span className="text-muted-foreground font-normal">ms</span>
    </div>
  );
}

/** Region codes are rotated to fit ~30 regions on the axis. */
function RegionTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  if (!payload) return null;
  const code = formatRegionCode(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        transform="rotate(-90)"
        className="fill-muted-foreground text-[10px]"
      >
        {code.length > 8 ? `${code.slice(0, 7)}…` : code}
      </text>
    </g>
  );
}
