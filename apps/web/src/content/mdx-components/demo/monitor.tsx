import type React from "react";

import { atTime, auditRow, demo, formatMs, hhmm } from "@/data/demo-data";
import { cn } from "@/lib/utils";

import {
  Cell,
  CellBody,
  CellDescription,
  CellFooter,
  CellGrid,
  CellGridItem,
  CellHeader,
  CellLabel,
  CellMetric,
  CellSwatch,
  CellTitle,
  chartClass,
  type Tone,
} from "./cell";

const MINUTES = 60;
const REGIONS = demo.regions.length;
const failing = demo.regions.filter((r) => r.status !== 200);
const healthy = demo.regions.filter((r) => r.status === 200);
const FAILING = failing.length;
const DEGRADED = healthy.filter(
  (r) => r.ms > demo.monitor.degradedAfter,
).length;
const healthyMs = healthy.map((r) => r.ms).sort((a, b) => a - b);
const p50 = healthyMs[Math.floor((healthyMs.length - 1) / 2)];
const p95 = Math.max(...demo.regions.map((r) => r.ms));
// The last three buckets are the spike.
const spikeAt = MINUTES - 3;

function noise(i: number, salt: number) {
  return Math.abs(Math.sin(i * 12.9898 + salt) * 43758.5453) % 1;
}

const PHASES = ["DNS", "Connect", "TLS", "TTFB", "Transfer"] as const;

// P95 per phase, per minute. The failing regions only move TTFB.
const latency = Array.from({ length: MINUTES }, (_, i) => {
  const spike = i >= spikeAt;
  return [
    10 + noise(i, 1) * 6,
    32 + noise(i, 2) * 10,
    56 + noise(i, 3) * 12,
    spike ? 3_800 + noise(i, 4) * 400 : 110 + noise(i, 4) * 60,
    9 + noise(i, 5) * 6,
  ];
});
const latencyMax = Math.max(...latency.map((p) => p.reduce((a, b) => a + b)));

const uptime = Array.from({ length: MINUTES }, (_, i) =>
  i >= spikeAt
    ? { ok: REGIONS - FAILING, error: FAILING }
    : { ok: REGIONS, error: 0 },
);

const metrics: { label: string; value: string; tone?: Tone }[] = [
  { label: "Uptime", value: demo.components[0].uptime, tone: "success" },
  { label: "Failing", value: String(FAILING), tone: "destructive" },
  { label: "Degraded", value: String(DEGRADED), tone: "warning" },
  { label: "P50", value: formatMs(p50) },
  { label: "P95", value: formatMs(p95) },
  { label: "Regions", value: String(REGIONS) },
];

const windowEnd = hhmm(auditRow("status_report.create").time);
const windowStart = new Date(
  atTime(new Date(0), windowEnd).getTime() - 3_600_000,
)
  .toISOString()
  .slice(11, 16);
const alertAt = hhmm(auditRow("monitor.alert").time);

const W = 480;
const H = 96;

/** Stacked areas, painted tallest cumulative first so each phase shows as its own band. */
function areaPath(upTo: number) {
  const step = W / (MINUTES - 1);
  const top = latency
    .map((phases, i) => {
      const y = phases.slice(0, upTo + 1).reduce((a, b) => a + b);
      return `${(i * step).toFixed(1)},${(H - (y / latencyMax) * H).toFixed(1)}`;
    })
    .join(" L");
  return `M0,${H} L${top} L${W},${H} Z`;
}

function Chart({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <CellBody className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function ChartHeader(props: React.ComponentProps<"div">) {
  return <div className="flex items-center justify-between gap-4" {...props} />;
}

function ChartLegend(props: React.ComponentProps<"span">) {
  return (
    <span
      className="text-muted-foreground flex flex-wrap gap-x-3 text-xs"
      {...props}
    />
  );
}

function ChartLegendItem({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1">
      <CellSwatch className={className} />
      {children}
    </span>
  );
}

function ChartPlot(props: React.ComponentProps<"div">) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3" {...props} />
  );
}

function ChartAxis(props: React.ComponentProps<"span">) {
  return (
    <span
      className="text-muted-foreground flex flex-col justify-between text-xs"
      {...props}
    />
  );
}

/** The monitor overview in the dashboard: metrics, uptime per bucket, latency by phase. */
export function MonitorDemo() {
  const { monitor } = demo;
  return (
    <Cell>
      <CellHeader>
        <CellTitle>{monitor.name}</CellTitle>
        <CellDescription>
          {monitor.method} {monitor.url.replace("https://", "")} · every{" "}
          {monitor.periodicity}
        </CellDescription>
      </CellHeader>
      <CellGrid cols={3} sm={6}>
        {metrics.map((m) => (
          <CellGridItem key={m.label}>
            <CellLabel>{m.label}</CellLabel>
            <CellMetric tone={m.tone}>{m.value}</CellMetric>
          </CellGridItem>
        ))}
      </CellGrid>

      <Chart>
        <ChartHeader>
          <CellLabel>Uptime · last hour</CellLabel>
          <ChartLegend>
            <ChartLegendItem className="bg-success">Success</ChartLegendItem>
            <ChartLegendItem className="bg-destructive">Error</ChartLegendItem>
            <ChartLegendItem className="bg-warning">Degraded</ChartLegendItem>
          </ChartLegend>
        </ChartHeader>
        <ChartPlot>
          <div className="flex h-16 items-end gap-px" aria-hidden>
            {uptime.map((b, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed series
              <span key={i} className="flex h-full flex-1 flex-col">
                <span
                  className="bg-destructive"
                  style={{ height: `${(b.error / REGIONS) * 100}%` }}
                />
                <span
                  className="bg-success"
                  style={{ height: `${(b.ok / REGIONS) * 100}%` }}
                />
              </span>
            ))}
          </div>
          <ChartAxis>
            <span>{REGIONS}</span>
            <span>{REGIONS / 2}</span>
            <span>0</span>
          </ChartAxis>
        </ChartPlot>
      </Chart>

      <Chart>
        <ChartHeader>
          <CellLabel>Latency · P95 · last hour</CellLabel>
          <ChartLegend>
            {PHASES.map((label, i) => (
              <ChartLegendItem
                key={label}
                className={chartClass[i % chartClass.length]}
              >
                {label}
              </ChartLegendItem>
            ))}
          </ChartLegend>
        </ChartHeader>
        <ChartPlot>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="border-border h-24 w-full border-b"
            aria-hidden
          >
            {PHASES.map((label, i) => (
              <path
                key={label}
                d={areaPath(PHASES.length - 1 - i)}
                fill={`var(--chart-${PHASES.length - i})`}
              />
            ))}
          </svg>
          <ChartAxis>
            <span>{formatMs(latencyMax)}</span>
            <span>{formatMs(latencyMax / 2)}</span>
            <span>0</span>
          </ChartAxis>
        </ChartPlot>
        <div className="text-muted-foreground -mt-0.5 flex justify-between text-xs">
          <span>{windowStart}</span>
          <span>{windowEnd}</span>
        </div>
      </Chart>

      <CellFooter>
        <span>Dashboard · monitor overview</span>
        <span>
          {FAILING} of {REGIONS} regions failing since {alertAt}
        </span>
      </CellFooter>
    </Cell>
  );
}
