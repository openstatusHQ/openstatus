import type React from "react";

import { demo } from "@/data/demo-data";
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
  CellTitle,
  type Tone,
} from "./cell";

const MINUTES = 60;
const REGIONS = demo.regions.length;
const FAILING = demo.regions.filter((r) => r.status !== 200).length;
// Last hour, one bucket per minute; the last three minutes are the 09:41 spike.
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
  { label: "Uptime", value: "99.94%", tone: "success" },
  { label: "Failing", value: String(FAILING), tone: "destructive" },
  { label: "Degraded", value: "0", tone: "warning" },
  { label: "P50", value: "231 ms" },
  { label: "P95", value: "4.21 s" },
];

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
      className="text-muted-foreground flex flex-wrap gap-x-3 text-[11px]"
      {...props}
    />
  );
}

function ChartLegendItem({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="size-2 rounded-xs" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

/** Plot on the left, y-axis ticks on the right. */
function ChartPlot(props: React.ComponentProps<"div">) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3" {...props} />
  );
}

function ChartAxis(props: React.ComponentProps<"span">) {
  return (
    <span
      className="text-muted-foreground flex flex-col justify-between text-[11px]"
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
      <CellGrid cols={3} sm={5}>
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
            <ChartLegendItem color="var(--success)">Success</ChartLegendItem>
            <ChartLegendItem color="var(--destructive)">Error</ChartLegendItem>
            <ChartLegendItem color="var(--warning)">Degraded</ChartLegendItem>
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
              <ChartLegendItem key={label} color={`var(--chart-${i + 1})`}>
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
            <span>4.2 s</span>
            <span>2.1 s</span>
            <span>0</span>
          </ChartAxis>
        </ChartPlot>
        <div className="text-muted-foreground -mt-0.5 flex justify-between text-[11px]">
          <span>08:44</span>
          <span>09:44</span>
        </div>
      </Chart>

      <CellFooter>
        <span>Dashboard · monitor overview</span>
        <span>
          {FAILING} of {REGIONS} regions failing since 09:41
        </span>
      </CellFooter>
    </Cell>
  );
}
